const VueLoaderPlugin = require('vue-loader/lib/plugin')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const WWPlugin = require('./ww_plugin.js')
const webpack = require('webpack')
const ImportPlugin = require('./import-plugin')
const path = require('path')


global.port = '8180'

module.exports = {    
    entry: './src/main.js',
    module: {
        rules: [{
                test: /\.vue$/,
                exclude: /node_modules/,
                loader: 'vue-loader'
            },
            {
                test: /\.js$/,
                exclude: /node_modules/,
                loader: 'babel-loader'
            },
            {
                test: /\.css$/,
                use: [
                    'vue-style-loader',
                    'css-loader'
                ]
            },
            {
                test: /script_ww\.js$/,
                loader: 'worker-loader'
            }
        ]
    },
    plugins: [
        new VueLoaderPlugin(),
        new HtmlWebpackPlugin({
            template: './src/index.html'
        }),
        new ImportPlugin(
            'http://localhost:8180/trading-vue.js',
            './node_modules/trading-vue-js/dist'
        ),
        new WWPlugin(),
        new webpack.DefinePlugin({
            MOB_DEBUG: JSON.stringify(process.env.MOB_DEBUG)
        })
    ],   




    devServer: {
        host: '0.0.0.0',
        proxy: {
            '/api/v1/**': {
                target: 'https://api.binance.com',
                changeOrigin: true
            },
            '/ws/**': {
                target: 'wss://stream.binance.com:9443',
                changeOrigin: true,
                ws: true
            },
            '/api/udf/**': {
                target: 'https://www.bitmex.com',
                changeOrigin: true
            },
        },
        onListening: function(server) {
            const port = server.listeningApp.address().port
            global.port = port
        },
        before(app){
            app.get("/debug", function(req, res) {
                try {
                    let argv = JSON.parse(req.query.argv)
                    console.log(...argv)
                } catch(e) {}
                res.send("[OK]")
            })
        }
    }
}
