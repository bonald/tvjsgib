<template>
  <!-- Real time data example -->
  <div>
    <div id="tvjs-tvjs" :style="{ top: top + 'px' }">
      <trading-vue
        :data="chart"
        :width="this.width"
        :height="this.height"
        title-txt="TVJS XP"
        :key="resetkey"
        ref="tvjs"
        skin="Alps"
        :toolbar="true"
        :extensions="ext"
        :overlays="overlays"
        :x-settings="xsett"        
        :legend-buttons="['display', 'settings', 'up', 'down', 'add', 'remove']"
        :chart-config="{ MIN_ZOOM: 1, DEFAULT_LEN: 70 }"
        :color-back="colors.colorBack"
        :color-grid="colors.colorGrid"
        :color-text="colors.colorText"
        :index-based="index_based"
      />
    </div>
  </div>
</template>


<script>
import {
  TradingVue,
  Utils,
  Constants,
  ScriptOverlay,
  BSB,
} from "trading-vue-js";

import { DataCube } from "trading-vue-js";

import Stream from "../stuff/stream.js";

import Extensions from "tvjs-xp";
import Overlays from "tvjs-overlays";
import StdInput from "tvjs-overlays";

import XP from "tvjs-xp";
import ChartLink from "tvjs-xp";
import GridResize from "tvjs-xp";
import LegendButtons from "tvjs-xp";
import SettingsWin from "tvjs-xp";

// Gettin' data through webpeck proxy
const PORT = location.port;
const URL = `http://localhost:${PORT}/api/v1/klines?symbol=`;
const WSS = `ws://localhost:${PORT}/ws/btcusdt@aggTrade`;

export default {
  name: "DataHelper",
  icon: "⚡",
  description: "Real-time updates. Play with DataCube in the console",
  props: ["night", "ext", "resetkey"],
  components: {
    TradingVue,
    StdInput,
  },
  mounted() {
    window.addEventListener("resize", this.onResize);
    this.onResize();

    // Load the last data chunk & init DataCube:
    let now = Utils.now();
    this.load_chunk([now - Constants.HOUR4, now]).then((data) => {
      this.chart = new DataCube(
        {
          ohlcv: data["chart.data"],
          onchart: [
            {
              type: "EMAx6",
              name: "Multiple EMA",
              data: [],
            },
          ],
          offchart: [
            {
              type: "BuySellBalance",
              name: "Buy/Sell Balance, $lookback",
              data: [],
              settings: {},
            },
          ],
          datasets: [
            {
              type: "Trades",
              id: "binance-btcusdt",
              data: [],
            },
          ],
        },
        { aggregation: 100 }
      );
      // Register onrange callback & And a stream of trades
      this.chart.onrange(this.load_chunk);
      this.$refs.tvjs.resetChart();
      this.stream = new Stream(WSS);
      this.stream.ontrades = this.on_trades;
      window.dc = this.dc; // Debug
      window.tv = this.$refs.tvjs; // Debug
    });
  },
  methods: {
    onResize(event) {
      this.width = window.innerWidth;
      this.height = window.innerHeight - 50;
    },
    // New data handler. Should return Promise, or
    // use callback: load_chunk(range, tf, callback)
    async load_chunk(range) {
      let [t1, t2] = range;
      let x = "BTCUSDT";
      let q = `${x}&interval=1m&startTime=${t1}&endTime=${t2}`;
      let r = await fetch(URL + q).then((r) => r.json());
      return this.format(this.parse_binance(r));
    },
    // Parse a specific exchange format
    parse_binance(data) {
      if (!Array.isArray(data)) return [];
      return data.map((x) => {
        for (var i = 0; i < x.length; i++) {
          x[i] = parseFloat(x[i]);
        }
        return x.slice(0, 6);
      });
    },
    format(data) {
      // Each query sets data to a corresponding overlay
      return {
        "chart.data": data,
        // other onchart/offchart overlays can be added here,
        // but we are using Script Engine to calculate some:
        // see EMAx6 & BuySellBalance
      };
    },
    on_trades(trade) {
      this.chart.update({
        t: trade.T, // Exchange time (optional)
        price: parseFloat(trade.p), // Trade price
        volume: parseFloat(trade.q), // Trade amount
        "datasets.binance-btcusdt": [
          // Update dataset
          trade.T,
          trade.m ? 0 : 1, // Sell or Buy
          parseFloat(trade.q),
          parseFloat(trade.p),
        ],
        // ... other onchart/offchart updates
      });
    },
  },
  beforeDestroy() {
    window.removeEventListener("resize", this.onResize);
    if (this.stream) this.stream.off();
  },
  computed: {
    colors() {
      return this.$props.night
        ? {}
        : {
            colorBack: "#fff",
            colorGrid: "#eee",
            colorText: "#333",
          };
    },
  },
  data() {
    return {      
      chart: new DataCube({tf: '1m'}),
      width: window.innerWidth,
      height: window.innerHeight,
      index_based: false,      
      xsett: {
        "grid-resize": { min_height: 30 },
      },
      overlays: Object.values(Overlays),
      //overlays: [ScriptOverlay, BSB, Object.values(Overlays)],
      //overlay_names: ["Default", ...Object.keys(Overlays)],
      current: "Default",
      top: 50,
      
    };
  },

};
</script>

<style>
html,
body {
  background-color: #000;
  margin: 0;
  padding: 0;
  overflow: hidden;
  font: 11px -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Oxygen, Ubuntu,
    Cantarell, Fira Sans, Droid Sans, Helvetica Neue, sans-serif;
}
#tvjs-header {
  position: absolute;
  height: 49px;
  color: #ddd;
  width: 100%;
  background-color: #121826;
  border-bottom: 1px solid black;
}
#tvjs-header img {
  width: 49px;
  height: 49px;
  margin: 0;
}

#tvjs-tvjs {
  position: absolute;
}
#tvjs-header h1 {
  color: #9b9ca0;
  margin: 0px 0 0 3px;
}
#tvjs-header p {
  position: absolute;
  width: 100%;
  top: 1px;
  text-align: center;
  font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Oxygen,
    Ubuntu, Cantarell, Fira Sans, Droid Sans, Helvetica Neue, sans-serif;
  font-weight: 200;
}
#overlays-lbl {
  position: absolute;
  top: 17px;
  color: #5e6061;
  right: 290px;
  font-weight: 600;
}
.night-mode {
  position: absolute;
  top: 15px;
  right: 20px;
}
.std-input {
  position: absolute;
  top: 5px;
  right: 70px;
  width: 200px;
  font-size: 1.2em;
}
</style>