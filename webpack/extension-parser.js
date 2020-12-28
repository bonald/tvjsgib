const vm = require('vm')
const fs = require('fs')
const colors = require('colors')
const minimist = require('minimist')
const pathmod = require('path')
const recursive = require('recursive-readdir-sync')


const argv = minimist(process.argv.slice(2))


const EXTENTIONS = './src/extensions/'
const ES6_IMPORT = /\bimport\s+(?:(.+)\s+from\s+)?[\'"]([^"\']+)["\']/g
const ES6_EXPDEF = /\bexport default\s+(?:(.+))/g

var names = []
// 'undefined' means parse/compile all
const LIST = argv.list ? argv.list.split(',') : undefined
const SL = argv.silent
const NAME = argv.name

function parse() {

    let extensions = []

    for (var f of fs.readdirSync(EXTENTIONS)) {

        if (f === '.DS_Store') continue
        if (f[0] === '_') continue

        let path = `${EXTENTIONS}${f}`
        if (LIST && !LIST.includes(f)) continue
        if (fs.statSync(path).isDirectory()) {
            if (!SL) process.stdout.write('Parsing '.gray + f)
            try {
                extensions.push(read_extension(path))
                if (!SL) console.log(' [OK]'.green)
            } catch(e) {

                if (!SL) {
                    console.log(' ⚠️  '.yellow + e)
                    console.log(f + ' excluded from the index'.red)
                }
            }
        }
    }

    // Name-checker
    if (NAME) name_checker()

    return extensions
}

function name_checker() {

    try {
        if (!name_format_check(NAME)) return
        if (names.includes(NAME.toLowerCase())) {
            throw `Name ${NAME.yellow} already exists`
        }
        console.log(`The name is cool`, '[OK]'.green)
    } catch(e) {
        console.log(' ⚠️  '.yellow + e)
    }

}

function read_extension(path) {

    let xfiles = []
    let dotvue = []

    let folder = path.split('/').reverse()[0]

    // check_scoped_styles(path)

    for (var f of fs.readdirSync(path)) {
        if (f === '.DS_Store') continue
        //console.log('   ', f)
        let arr = f.split('.')

        if (arr[1] === 'vue') {
            dotvue.push({
                path: `${path}/${f}`,
                name: arr[0]
            })
        }

        if (f === 'x.json') {
            xfiles.push({
                path: `${path}/${f}`,
                name: 'x'
            })
        }
    }

    if (xfiles.length !== 1) {
        throw "There is no x.json file (meta info)"
    }

    let x = openx(xfiles)
    parse_widgets(path, x)

    return x

/*    let info = extract_info(dotvue[0].path)
    let name = dotvue[0].name
    info.path = path

    if (name !== info.name) throw "File name !== extension name"

    if (name !== folder) throw "Folder name !== extension name"

    checks(info)*/
}

function openx(xfiles) {
    return JSON.parse(fs.readFileSync(xfiles[0].path, 'utf-8'))
}

function parse_widgets(path, x) {
    let arr = []

    for (let w of x.widgets || []) {
        let info = extract_info(`${path}/${w}`)
        w = w.split('.').slice(0,-1).join('.')
        info.path = path
        arr.push(info)
        if (w !== info.name) {
            throw "Widget name !== file name"
        }
    }
    x.widgets = arr
}

function checks(info) {

    if (names.includes(info.name.toLowerCase()))
        throw "Extention's name is not unique"


    if (typeof info.methods.meta_info !== 'function')
        throw "meta_info() method is required"

    if (typeof info.methods.use_for !== 'function')
        throw "use_for() method is required"

    if (typeof info.methods.draw !== 'function' &&
        !calc_render_check(info))
        throw "draw() method is required" +
              "(or custom calc().conf renderer)"

    if (!info.methods.use_for().includes(info.name))
        throw "use_for() doesn't include extension's name"

    if (info.methods.use_for().length !== 1)
        throw "use_for() should use have length === 1"

    if (!name_format_check(info.name))
        throw "Extention name has wrong format"

    if (!info.methods.meta_info().author)
        throw "Extention's meta_info contains no 'author'"

    if (!info.methods.meta_info().version)
        throw "Extention's meta_info contains no 'version'"

    if (!data_json_check(info))
        throw "Problem with data.json"

    README_check(info)
    DESC_check(info)

    names.push(info.name.toLowerCase())

}

function name_format_check(name) {
     if (!/^[a-zA-Z_0-9]*/.test(name)) {
         console.log("⚠️  Only a-Z, 0-9 and _ are alowed")
         return false
     }
     if (name[0] !== name[0].toUpperCase()) {
         console.log("⚠️  First latter should be capital")
         return false
     }
     return true
}

function calc_render_check(info) {
    let calc = info.methods.calc()
    return calc.conf && calc.conf.renderer
}

function data_json_check(info) {

    let path = info.path + '/data.json'

    if (!fs.existsSync(path)) {
        throw `The folder should contain data.json (sample of data)`
    }

    let stats = fs.statSync(path)
    let size = stats.size / 1000000.0

    if (size > 1) {
        throw `data.json should be less than 1MB`
    }

    return true

}

function README_check(info) {

    let path = info.path + '/README.md'

    if (!fs.existsSync(path)) {
        if (!SL) process.stdout.write(
            '\n💡 Add README.md on how to use your extension'.gray
        )
    }
}

function DESC_check(info) {

    if (!info.methods.meta_info().desc) {
        if (!SL) process.stdout.write(
            `\n💡 Add a description: { author: '...', desc: '...' }`.gray
        )
    }
}

function check_scoped_styles(path) {
    files = recursive(path)
    for (var file of files) {
        if (file.split('.').pop() === 'vue') {
            let content = fs.readFileSync(file, 'utf8')
            let tag = style_tag(content)
            if(tag && tag[1] !== 'scoped') {
                let f = pathmod.basename(file)
                throw `${f}: Styles should be scoped: <style scoped>`
            }
        }
    }
}

function style_tag(str) {
    const reg = new RegExp(
        '<style\\s*([a-zA-Z]+)?\\s*>[^\0]*?<\/style>',
        'gm')
    let res = reg.exec(str)
    return res
}

function extract_info(file, content) {

    if (!content) content = fs.readFileSync(file, 'utf8')

    content = content.replace(/<\/?script>/g, '')
    content = content.replace(/<template>[\S\s]+<\/template>/g, '')
    content = content.replace(/<style.*?>[\S\s]+<\/style>/g, '')
    content = content.replace(/export\s+default/g, 'Export_Default = ')
    content = parse_imports(content)

    try {
        // We use vm as a safe way to parse the extension
        // structure. It doesn't support full ES6, so
        // the code must be cleaned before the exec.
        let struct = vm.runInNewContext(content)
        struct.raw_src = content
        return struct
    } catch(e) {
        console.log(e)
        return {}
    }

}

function parse_imports(src) {
    let rex = regex_clone(ES6_IMPORT)
    let symbols = []
    do {
        var m = rex.exec(src)
        if (m) {
            let imp = m[1].replace(/\{|\}|\s/g, '')
            symbols.push(...imp.split(','))
        }
    } while (m)
    let pre = ''
    symbols.forEach(x => {
        pre += `let ${x} = {}\n`
    })
    return pre + remove_imports(src)
}

function vers_greater(v1, v2) {
    v1 = v1.split('.')
    v2 = v2.split('.')
    for (var i = 0; i < v1.length; i++) {
        let a = ~~v1[i]
        let b = ~~v2[i]
        if (a > b) return true
        if (a < b) return false
    }
    return false
}

function regex_clone(rex) {
    return new RegExp(rex.source, rex.flags)
}

function remove_imports(src) {
    ES6_IMPORT.lastIndex = 0
    return src.replace(ES6_IMPORT, '')
}

if (require.main === module) {
    parse()
}

module.exports.parse = parse
module.exports.read_extension = read_extension
module.exports.extract_info = extract_info
