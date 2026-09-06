/* clinic-admin — entry point.
   Boot order: core + shell chrome evaluate on import (area rail / bottom bar wiring, last-panel restore, modals,
   global search, AI drawer, LOCK SCREEN), then boot() waits for the first PIN unlock + data load, initialises
   every tool module, fires app:ready, and finally the 접수 보드 boots (it needs the unlocked
   workspace key to encrypt cards).
   Tab modules are passed as namespaces: shell.boot() calls their init(ctx), shell.seedAll() their seed(ctx).
   Seed order: claims tools first (they create the shared sample batch), reporting, the code index / masters panel,
   the AI drawer, roster, accred, the claims landing (derives), 홈 last (derives everything). */
import { boot } from "./shell.js";
import * as Tab0 from "./tabs/tab0-today.js";
import * as Tab1 from "./tabs/tab1-kcd.js";
import * as Tab2 from "./tabs/tab2-jabo.js";
import * as Tab3 from "./tabs/tab3-yearend.js";
import * as Tab4 from "./tabs/tab4-bigeup.js";
import * as Tab5 from "./tabs/tab5-retention.js";
import * as Tab6 from "./tabs/tab6-search.js";
import * as Tab7 from "./tabs/tab7-ai.js";
import * as Tab8 from "./tabs/tab8-license.js";
import * as Tab9 from "./tabs/tab9-accred.js";
import * as Claims from "./tabs/claims-landing.js";
import * as Guarantee from "./tabs/tab-guarantee.js";
import * as Docs from "./tabs/tab-docs.js";
import * as Consent from "./tabs/tab-consent.js";
import * as Nhis from "./tabs/tab-nhis.js";
import * as Appeal from "./tabs/tab-appeal.js";
import { boot as bootBoard } from "./board.js";

// Bump on every user-visible release; shown in the info modal next to the SW cache name.
export const APP_VERSION = "2.2.0-poc";

boot([Tab1, Tab2, Tab3, Tab4, Tab5, Tab6, Tab7, Tab8, Tab9, Claims, Guarantee, Docs, Consent, Nhis, Appeal, Tab0], { version: APP_VERSION })
  .then(() => bootBoard());
