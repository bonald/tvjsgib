<template>
  <trading-vue
    :data="dc"
    :width="this.width"
    :height="this.height"
    title-txt="TVJS XP"
    :key="resetkey"
    ref="tvjs"
    :legend-buttons="['display', 'settings', 'up', 'down', 'add', 'remove']"
    :chart-config="{ DEFAULT_LEN: 70 }"
    :color-back="colors.colorBack"
    :color-grid="colors.colorGrid"
    :color-text="colors.colorText"
    :extensions="ext"
    :overlays="overlays"
    :x-settings="xsett"
    
  />

</template>
<script>

import { TradingVue, Utils, Constants } from "trading-vue-js";
import { DataCube } from "trading-vue-js";
import Stream from "../stuff/stream.js";
import Extensions from "tvjs-xp";
import Overlays from "tvjs-overlays";
//import Data from '../../data/data.json'

const PORT = location.port;
const URL = `http://localhost:${PORT}/api/v1/klines?symbol=`;
const WSS = `ws://localhost:${PORT}/ws/btcusdt@aggTrade`;

export default {
  name: "App1",
  props: ["night", "ext", "resetkey"],
  components: {
    TradingVue,
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
        "dc.data": data,
        // other onchart/offchart overlays can be added here,
        // but we are using Script Engine to calculate some:
        // see EMAx6 & BuySellBalance
      };
    },
    on_trades(trade) {
      this.dc.update({
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
  mounted() {
    window.addEventListener("resize", this.onResize);
    this.onResize();
    window.dc = this.dc;
    window.tv = this.$refs.tvjs;

    // Load the last data chunk & init DataCube:
    let now = Utils.now();
    this.load_chunk([now - Constants.HOUR4, now]).then((data) => {
      this.dc = new DataCube(
        {
          ohlcv: data["dc.data"],
          onchart: [
            {
              name: "EMA1",
              type: "Spline",
              data: [],
            },
          ],
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
      this.dc.onrange(this.load_chunk);
      this.$refs.tvjs.resetChart();
      this.stream = new Stream(WSS);
      this.stream.ontrades = this.on_trades;
    });
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
  beforeDestroy() {
    window.removeEventListener("resize", this.onResize);
  },
  data() {
    return {
      dc: new DataCube({}),     
      width: window.innerWidth,
      height: window.innerHeight,
      xsett: {
        "grid-resize": { min_height: 30 },
      },
      overlays: Object.values(Overlays),
    };
  },
};
</script>
<style>
</style>
