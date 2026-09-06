/* clinic-admin — entry point.
   Boot order mirrors the former single-file build: core + shell chrome evaluate on import
   (rail wiring, last-tab restore, modals, palette), then data loads and tabs 1‥9 then 0
   initialise, app:ready fires, and finally the 접수 보드 boots. */
import { boot } from "./shell.js";
import { initTab0 } from "./tabs/tab0-today.js";
import { initTab1 } from "./tabs/tab1-kcd.js";
import { initTab2 } from "./tabs/tab2-jabo.js";
import { initTab3 } from "./tabs/tab3-yearend.js";
import { initTab4 } from "./tabs/tab4-bigeup.js";
import { initTab5 } from "./tabs/tab5-retention.js";
import { initTab6 } from "./tabs/tab6-search.js";
import { initTab7 } from "./tabs/tab7-ai.js";
import { initTab8 } from "./tabs/tab8-license.js";
import { initTab9 } from "./tabs/tab9-accred.js";
import { boot as bootBoard } from "./board.js";

boot([initTab1, initTab2, initTab3, initTab4, initTab5, initTab6, initTab7, initTab8, initTab9, initTab0]);
bootBoard();
