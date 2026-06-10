/*
 * 책친구 catalog — append-only book data for the kids-bookshelf demo.
 *
 * TO ADD A BOOK: append one object to BOOKS below. No other file changes needed —
 * scoring, rendering, and the AI prompt all read this array dynamically.
 *
 * Schema (every field except titleRoman/isbn is required):
 *   id         string  stable kebab slug, globally unique, NEVER reused   e.g. "kr-gureumppang"
 *   lang       "ko"|"en"   drives the 🇰🇷/🇬🇧 flag and cover behavior
 *   title      string  canonical title in its own script (한글 for ko)
 *   titleRoman string? optional romanization, EN-reader reference only
 *   author     string  in its own script
 *   publisher  string
 *   ages       string[]  subset of ["0-2","3-4","5-6","7-9"]
 *   level      "보드북"|"그림책"|"책읽기"|"초기챕터북"
 *   themes     string[]  from THEME_VOCAB (see below)
 *   mood       string[]  from MOOD_VOCAB
 *   blurb      string  curated "왜 이 책일까요?" sentence (한국어)
 *   readAloud  string  one-line "함께 읽기 팁" (한국어)
 *   cover      {emoji:string, palette:string[]}  for the SVG placeholder cover
 *   isbn       string?  ISBN-13; EN titles use it for an Open Library cover swap
 *   source     "curated"|"ai"   curated launch data; "ai" = promoted suggestion
 *
 * Controlled vocabularies (keep chips/scoring in sync with these):
 *   THEME_VOCAB: 공룡 우주 동물 공주 자동차 탈것 그림그리기 잠자리 자연 음식 가족 친구 감정 일상 환상 모험 숫자/글자 유머
 *   MOOD_VOCAB:  웃긴 따뜻한 모험 학습 잔잔한
 */
window.THEME_VOCAB = ["공룡","우주","동물","공주","자동차","탈것","그림그리기","잠자리","자연","음식","가족","친구","감정","일상","환상","모험","숫자/글자","유머"];
window.MOOD_VOCAB  = ["웃긴","따뜻한","모험","학습","잔잔한"];
window.BOOKS = [
  // ──────────────────────────────────────────────────────────────
  // POOL A — 한국 그림책 (Korean picture-book canon)
  // ──────────────────────────────────────────────────────────────
  {
    id: "kr-gureumppang", lang: "ko",
    title: "구름빵", author: "백희나", publisher: "한솔수북",
    ages: ["3-4","5-6"], level: "그림책",
    themes: ["환상","가족","음식","일상"], mood: ["따뜻한","잔잔한"],
    blurb: "비 오는 날 구름으로 만든 빵을 먹고 하늘을 나는 남매 이야기로, 백희나 특유의 입체 사진 그림이 환상적이에요.",
    readAloud: "빵을 먹고 둥실 떠오르는 장면에서 아이를 살짝 안아 올려 보세요.",
    cover: { emoji: "🍞", palette: ["#cfe3f0","#e8c98a"] },
    source: "curated"
  },
  {
    id: "kr-dal-sherbet", lang: "ko",
    title: "달 샤베트", author: "백희나", publisher: "책읽는곰",
    ages: ["3-4","5-6"], level: "그림책",
    themes: ["환상","자연","가족"], mood: ["잔잔한","따뜻한"],
    blurb: "무더운 여름밤 녹아내린 달을 받아 샤베트로 만든 반장 할머니의 따뜻한 상상력이 빛나요.",
    readAloud: "더운 여름밤 불을 끄고 읽으면 달빛 분위기가 살아나요.",
    cover: { emoji: "🌙", palette: ["#2b3a67","#f2d680"] },
    source: "curated"
  },
  {
    id: "kr-alsatang", lang: "ko",
    title: "알사탕", author: "백희나", publisher: "책읽는곰",
    ages: ["5-6","7-9"], level: "그림책",
    themes: ["감정","친구","가족","환상"], mood: ["따뜻한","잔잔한"],
    blurb: "마음의 소리가 들리는 알사탕을 먹은 동동이가 아빠와 친구의 진심을 듣게 되는 이야기예요.",
    readAloud: "알사탕을 하나씩 먹을 때마다 들리는 목소리를 다른 톤으로 연기해 보세요.",
    cover: { emoji: "🍬", palette: ["#e85d75","#f6c453"] },
    source: "curated"
  },
  {
    id: "kr-jangsutang", lang: "ko",
    title: "장수탕 선녀님", author: "백희나", publisher: "책읽는곰",
    ages: ["5-6","7-9"], level: "그림책",
    themes: ["환상","가족","일상"], mood: ["따뜻한","웃긴"],
    blurb: "오래된 목욕탕 장수탕에서 만난 선녀 할머니와 덕지의 우정을 정겨운 한국 정서로 그렸어요.",
    readAloud: "냉탕에 들어가는 장면에서 \"으악, 차가워!\" 하고 함께 소리쳐 보세요.",
    cover: { emoji: "🛁", palette: ["#9fd3c7","#e6e6e6"] },
    source: "curated"
  },
  {
    id: "kr-isanghan-eomma", lang: "ko",
    title: "이상한 엄마", author: "백희나", publisher: "책읽는곰",
    ages: ["3-4","5-6"], level: "그림책",
    themes: ["가족","환상","감정","일상"], mood: ["따뜻한","잔잔한"],
    blurb: "아픈 호호를 돌봐 줄 사람을 찾다 잘못 걸려온 하늘나라 선녀가 엄마가 되어 주는 포근한 이야기예요.",
    readAloud: "구름으로 만든 달걀부침 장면을 아이와 함께 상상하며 읽어 보세요.",
    cover: { emoji: "🍳", palette: ["#bcd4e6","#f4e1a0"] },
    source: "curated"
  },
  {
    id: "kr-gangaji-ddong", lang: "ko",
    title: "강아지똥", author: "권정생", publisher: "길벗어린이",
    ages: ["5-6","7-9"], level: "그림책",
    themes: ["자연","감정","친구"], mood: ["따뜻한","잔잔한"],
    blurb: "보잘것없어 보이던 강아지똥이 민들레꽃을 피우며 세상에 쓸모없는 존재는 없다는 걸 알려 줘요.",
    readAloud: "마지막 민들레가 피는 장면에서 잠시 멈춰 \"강아지똥이 어떻게 됐을까?\" 물어보세요.",
    cover: { emoji: "🌼", palette: ["#a8763e","#f2d94e"] },
    source: "curated"
  },
  {
    id: "kr-mongsil-eonni", lang: "ko",
    title: "몽실 언니", author: "권정생", publisher: "창비",
    ages: ["7-9"], level: "초기챕터북",
    themes: ["가족","감정","일상"], mood: ["잔잔한","따뜻한"],
    blurb: "전쟁과 가난 속에서도 동생을 보살피는 몽실이의 강인함이 깊은 울림을 주는 한국 동화예요.",
    readAloud: "조금 긴 이야기이니 하루 한 장씩 나눠 읽으며 몽실이 마음을 함께 이야기해 보세요.",
    cover: { emoji: "👧", palette: ["#8a6d3b","#d9c5a0"] },
    source: "curated"
  },
  {
    id: "kr-geurimja-nori", lang: "ko",
    title: "그림자놀이", author: "이수지", publisher: "비룡소",
    ages: ["3-4","5-6"], level: "그림책",
    themes: ["환상","그림그리기","일상"], mood: ["잔잔한","학습"],
    blurb: "불을 켜자 살아나는 그림자들이 펼치는 글 없는 그림책으로, 상상의 세계가 페이지마다 자라나요.",
    readAloud: "글이 없으니 아이가 그림을 보며 직접 이야기를 지어내게 해 보세요.",
    cover: { emoji: "🌑", palette: ["#f2c94c","#1a1a1a"] },
    source: "curated"
  },
  {
    id: "kr-pado-ya", lang: "ko",
    title: "파도야 놀자", author: "이수지", publisher: "비룡소",
    ages: ["0-2","3-4"], level: "그림책",
    themes: ["자연","감정","일상"], mood: ["잔잔한"],
    blurb: "바닷가에서 파도와 밀고 당기며 노는 아이의 마음을 파랑과 흑백만으로 시원하게 담은 글 없는 그림책이에요.",
    readAloud: "파도가 밀려올 때 \"와아\" 하고 손으로 파도를 그려 보여 주세요.",
    cover: { emoji: "🌊", palette: ["#3aa0d6","#eef3f6"] },
    source: "curated"
  },
  {
    id: "kr-subak-suyeong", lang: "ko",
    title: "수박 수영장", author: "안녕달", publisher: "창비",
    ages: ["3-4","5-6"], level: "그림책",
    themes: ["음식","환상","일상","자연"], mood: ["웃긴","잔잔한"],
    blurb: "거대한 수박이 수영장이 되는 무더운 여름날의 상상으로, 시원함과 즐거움이 가득해요.",
    readAloud: "수박물에 풍덩 빠지는 장면에서 \"첨벙!\" 효과음을 함께 내 보세요.",
    cover: { emoji: "🍉", palette: ["#e34b54","#3aaf5c"] },
    source: "curated"
  },
  {
    id: "kr-halmeoni-yeoreum", lang: "ko",
    title: "할머니의 여름휴가", author: "안녕달", publisher: "창비",
    ages: ["5-6","7-9"], level: "그림책",
    themes: ["가족","자연","환상"], mood: ["잔잔한","따뜻한"],
    blurb: "손주가 주워 온 소라 껍데기에서 흘러나온 바다로 떠나는 할머니의 여름휴가가 잔잔한 위로를 줘요.",
    readAloud: "소라를 귀에 대면 바다 소리가 들린다고 알려 주고 함께 흉내 내 보세요.",
    cover: { emoji: "🐚", palette: ["#6db5c7","#f0e3c2"] },
    source: "curated"
  },
  {
    id: "kr-sol-chuseok", lang: "ko",
    title: "솔이의 추석 이야기", author: "이억배", publisher: "길벗어린이",
    ages: ["5-6","7-9"], level: "그림책",
    themes: ["가족","일상","자연"], mood: ["따뜻한","잔잔한"],
    blurb: "추석을 맞아 고향에 내려가는 솔이네 가족의 모습으로 우리 명절 풍경을 정겹게 담았어요.",
    readAloud: "그림 속 시골 길과 차례상을 가리키며 우리 가족 명절 이야기를 들려주세요.",
    cover: { emoji: "🌕", palette: ["#c98a3b","#f2dca0"] },
    source: "curated"
  },
  {
    id: "kr-sonkeun-halmeoni", lang: "ko",
    title: "손 큰 할머니의 만두 만들기", author: "채인선", publisher: "재미마주",
    ages: ["3-4","5-6"], level: "그림책",
    themes: ["가족","음식","일상","동물"], mood: ["따뜻한","웃긴"],
    blurb: "설을 앞두고 산더미처럼 만두를 빚는 손 큰 할머니와 동물들의 흥겨운 만두 잔치예요.",
    readAloud: "만두 빚는 시늉을 손으로 함께 하며 읽으면 더 신나요.",
    cover: { emoji: "🥟", palette: ["#e8b04b","#f6efe2"] },
    source: "curated"
  },
  {
    id: "kr-jigak-john", lang: "ko",
    title: "지각대장 존", author: "존 버닝햄", publisher: "비룡소",
    titleRoman: "John Patrick Norman McHennessy (KR ed.)",
    ages: ["5-6","7-9"], level: "그림책",
    themes: ["유머","환상","일상","모험"], mood: ["웃긴","모험"],
    blurb: "학교 가는 길에 악어와 사자를 만나 늘 지각하는 존의 이야기로, 어른의 불신을 유쾌하게 꼬집어요.",
    readAloud: "선생님의 호통과 존의 변명을 서로 다른 목소리로 연기해 보세요.",
    cover: { emoji: "🐊", palette: ["#5a8f3c","#e8d49a"] },
    source: "curated"
  },
  {
    id: "kr-yonggamhan-irene", lang: "ko",
    title: "용감한 아이린", author: "윌리엄 스타이그", publisher: "웅진주니어",
    titleRoman: "Brave Irene (KR ed.)",
    ages: ["5-6","7-9"], level: "그림책",
    themes: ["모험","가족","감정","자연"], mood: ["모험","따뜻한"],
    blurb: "아픈 엄마 대신 눈보라를 뚫고 드레스를 배달하는 아이린의 용기가 가슴을 뭉클하게 해요.",
    readAloud: "바람이 거세지는 장면에서 목소리를 점점 크게 해 긴장감을 살려 보세요.",
    cover: { emoji: "❄️", palette: ["#cfe0ec","#d65a5a"] },
    source: "curated"
  },
  {
    id: "kr-gwaenchana", lang: "ko",
    title: "괜찮아", author: "최숙희", publisher: "웅진주니어",
    ages: ["3-4","5-6"], level: "그림책",
    themes: ["감정","동물","일상"], mood: ["따뜻한","학습"],
    blurb: "느려도, 작아도, 못해도 \"괜찮아\"라고 다독여 주며 아이의 자존감을 따뜻하게 키워 줘요.",
    readAloud: "한 장면마다 아이를 보며 \"괜찮아\" 하고 함께 말해 주세요.",
    cover: { emoji: "🤗", palette: ["#f4b6c2","#fff3e0"] },
    source: "curated"
  },
  {
    id: "kr-eomma-majung", lang: "ko",
    title: "엄마 마중", author: "이태준", publisher: "보림",
    ages: ["3-4","5-6"], level: "그림책",
    themes: ["가족","감정","일상"], mood: ["잔잔한","따뜻한"],
    blurb: "전차 정류장에서 엄마를 기다리는 아기의 모습을 옛 그림으로 담은, 기다림의 정서가 깊은 그림책이에요.",
    readAloud: "\"엄마 안 와?\" 하고 묻는 아기 마음을 함께 천천히 따라가 보세요.",
    cover: { emoji: "🚋", palette: ["#b5651d","#efe6d3"] },
    source: "curated"
  },
  {
    id: "kr-go-nyeoseok", lang: "ko",
    title: "고 녀석 맛있겠다", author: "미야니시 타츠야", publisher: "달리",
    titleRoman: "You Are Umasou (KR ed.)",
    ages: ["3-4","5-6"], level: "그림책",
    themes: ["공룡","가족","감정","모험"], mood: ["따뜻한","모험"],
    blurb: "잡아먹으려던 아기 공룡을 아들로 키우게 된 티라노사우루스의 뭉클한 부정을 그린 인기 공룡 그림책이에요.",
    readAloud: "사나운 공룡 목소리와 아기 공룡 \"아빠!\" 목소리를 대비시켜 읽어 보세요.",
    cover: { emoji: "🦖", palette: ["#3f7d3f","#e6a23c"] },
    source: "curated"
  },
  {
    id: "kr-doseogwan-saja", lang: "ko",
    title: "도서관에 간 사자", author: "미셸 누드슨", publisher: "웅진주니어",
    titleRoman: "Library Lion (KR ed.)",
    ages: ["5-6","7-9"], level: "그림책",
    themes: ["동물","친구","일상","감정"], mood: ["따뜻한","웃긴"],
    blurb: "도서관 규칙을 지키며 모두의 친구가 된 사자가 규칙과 마음 사이에서 진짜 중요한 게 뭔지 보여 줘요.",
    readAloud: "도서관에서는 작게 말해야 한다고 속삭이듯 읽다가 사자가 포효하는 장면에서 살짝 크게!",
    cover: { emoji: "🦁", palette: ["#d98a2b","#efe2c2"] },
    source: "curated"
  },
  {
    id: "kr-baekgu", lang: "ko",
    title: "백구", author: "김민기", publisher: "사계절",
    ages: ["5-6","7-9"], level: "그림책",
    themes: ["동물","가족","감정"], mood: ["잔잔한","따뜻한"],
    blurb: "한 아이와 흰둥이 백구가 함께 자라며 나누는 우정과 이별을 노랫말처럼 잔잔하게 그렸어요.",
    readAloud: "원곡 노래 '백구'를 함께 흥얼거리며 읽으면 감동이 배가돼요.",
    cover: { emoji: "🐕", palette: ["#e8e2d4","#9a8f7a"] },
    source: "curated"
  },
  {
    id: "kr-assibang", lang: "ko",
    title: "아씨방 일곱 동무", author: "이영경", publisher: "비룡소",
    ages: ["5-6","7-9"], level: "그림책",
    themes: ["일상","유머","환상"], mood: ["웃긴","학습"],
    blurb: "바늘·실·가위·자·골무·인두·다리미 일곱 바느질 동무가 서로 제일이라 다투는 우리 옛이야기로, 옛 살림살이를 정겹게 만나요.",
    readAloud: "바느질 도구를 하나씩 가리키며 \"이건 뭐 하는 물건일까?\" 하고 물어보세요.",
    cover: { emoji: "🧵", palette: ["#c44a52","#f0d59a"] },
    source: "curated"
  },
  {
    id: "kr-nuga-naui-seulpeum", lang: "ko",
    title: "누가 내 머리에 똥 쌌어?", author: "베르너 홀츠바르트", publisher: "사계절",
    titleRoman: "The Story of the Little Mole (KR ed.)",
    ages: ["3-4","5-6"], level: "그림책",
    themes: ["동물","유머","일상"], mood: ["웃긴","학습"],
    blurb: "머리에 똥을 맞은 두더지가 범인을 찾아 나서는 유쾌한 추리로, 아이들이 깔깔 웃으며 동물 똥을 배워요.",
    readAloud: "동물들의 똥 모양을 비교하는 장면에서 \"이건 누구 똥일까?\" 퀴즈를 내 보세요.",
    cover: { emoji: "💩", palette: ["#8a6d3b","#cbe3a0"] },
    source: "curated"
  },
  {
    id: "kr-geumbungeo", lang: "ko",
    title: "금붕어가 달아나네", author: "고미 타로", publisher: "한림출판사",
    titleRoman: "Where's the Fish? (KR ed.)",
    ages: ["0-2","3-4"], level: "보드북",
    themes: ["동물","일상","유머"], mood: ["웃긴","잔잔한"],
    blurb: "달아난 금붕어가 비슷하게 생긴 물건들 사이에 숨는 숨은그림찾기 구성으로, 아기가 손끝으로 짚으며 까르르 즐겨요.",
    readAloud: "페이지마다 \"금붕어 어디 있지?\" 하고 아이가 직접 찾게 해 보세요.",
    cover: { emoji: "🐟", palette: ["#f4c430","#e85d75"] },
    source: "curated"
  },
  {
    id: "kr-aegyo-jeonseol", lang: "ko",
    title: "이파라파냐무냐무", author: "이지은", publisher: "사계절",
    ages: ["3-4","5-6"], level: "그림책",
    themes: ["친구","감정","유머","환상"], mood: ["웃긴","따뜻한"],
    blurb: "무섭게만 보였던 솜털 괴물과 마시멜로들이 오해를 풀고 친구가 되는 과정을 통통 튀는 말맛으로 그렸어요.",
    readAloud: "\"이파라파냐무냐무\" 주문을 아이와 함께 큰 소리로 외쳐 보세요.",
    cover: { emoji: "👾", palette: ["#f4a6c0","#a0d8ef"] },
    source: "curated"
  },
  {
    id: "kr-doldol", lang: "ko",
    title: "팥죽 할멈과 호랑이", author: "박윤규", publisher: "시공주니어",
    ages: ["5-6","7-9"], level: "그림책",
    themes: ["환상","유머","음식","동물"], mood: ["웃긴","모험"],
    blurb: "호랑이를 물리치려 팥죽 할멈을 돕는 알밤, 자라, 송곳, 멍석의 활약을 그린 우리 전래동화예요.",
    readAloud: "알밤이 튀고 자라가 무는 장면마다 \"퍽! 콱!\" 효과음을 넣어 읽어 보세요.",
    cover: { emoji: "🐯", palette: ["#b5651d","#e8c07a"] },
    source: "curated"
  },
  {
    id: "kr-kkachi", lang: "ko",
    title: "팥이 영감과 우르르 산토끼", author: "박재철", publisher: "길벗어린이",
    ages: ["3-4","5-6"], level: "그림책",
    themes: ["동물","유머","일상"], mood: ["웃긴","잔잔한"],
    blurb: "우리 옛이야기 특유의 반복과 리듬이 살아 있어 아이가 다음 장면을 예측하며 즐기게 돼요.",
    readAloud: "반복되는 후렴을 아이가 따라 말하도록 잠깐씩 멈춰 주세요.",
    cover: { emoji: "🐰", palette: ["#c98a3b","#e8e0c8"] },
    source: "curated"
  },
  {
    id: "kr-sseodeolheun", lang: "ko",
    title: "사과가 쿵!", author: "다다 히로시", publisher: "보림",
    titleRoman: "(KR ed.)",
    ages: ["0-2","3-4"], level: "보드북",
    themes: ["동물","음식","일상"], mood: ["잔잔한","따뜻한"],
    blurb: "커다란 사과 하나에 동물들이 차례로 모여 나눠 먹는 모습을 큼직한 그림과 짧은 글로 담아 아기에게 좋아요.",
    readAloud: "\"쿵!\" 소리에 맞춰 책을 살짝 흔들어 주면 아기가 까르르 웃어요.",
    cover: { emoji: "🍎", palette: ["#e0413e","#8bc34a"] },
    source: "curated"
  },
  {
    id: "kr-no-david", lang: "ko",
    title: "안 돼, 데이빗!", author: "데이비드 섀논", publisher: "지경사",
    titleRoman: "No, David! (KR ed.)",
    ages: ["3-4","5-6"], level: "그림책",
    themes: ["가족","감정","일상","유머"], mood: ["웃긴","따뜻한"],
    blurb: "온갖 장난을 치는 데이빗에게 \"안 돼!\"를 외치다 결국 \"사랑해\"로 끝나는, 아이 마음을 꼭 안아 주는 책이에요.",
    readAloud: "\"안 돼, 데이빗!\"을 아이와 번갈아 외치며 장난스럽게 읽어 보세요.",
    cover: { emoji: "🙅", palette: ["#e8595e","#f4d03f"] },
    source: "curated"
  },
  {
    id: "kr-kkokkkok-sumeo", lang: "ko",
    title: "두드려 보아요", author: "안나 클라라 티돌름", publisher: "사계절",
    titleRoman: "Knock! Knock! (KR ed.)",
    ages: ["0-2","3-4"], level: "보드북",
    themes: ["일상","환상","동물"], mood: ["잔잔한","따뜻한"],
    blurb: "문을 똑똑 두드리며 한 장씩 넘기는 반복 구조로 아기가 직접 책장을 넘기고 싶게 만들어요.",
    readAloud: "책장을 넘기기 전에 \"똑똑\" 하고 책을 두드려 기대감을 주세요.",
    cover: { emoji: "🚪", palette: ["#d98a2b","#f0e3c2"] },
    source: "curated"
  },
  {
    id: "kr-jeo-mari", lang: "ko",
    title: "지원이와 병관이", author: "고대영", publisher: "길벗어린이",
    ages: ["3-4","5-6"], level: "그림책",
    themes: ["일상","가족","친구","감정"], mood: ["따뜻한","웃긴"],
    blurb: "친근한 두 아이의 평범한 하루를 통해 또래 아이가 자기 일상을 책 속에서 만나는 인기 생활 그림책 시리즈예요.",
    readAloud: "\"너도 이런 적 있어?\" 하고 아이의 비슷한 경험을 물어보세요.",
    cover: { emoji: "🧒", palette: ["#7fb069","#f6c453"] },
    source: "curated"
  },
  {
    id: "kr-yuchiwon-ganeun-gil", lang: "ko",
    title: "치과 의사 드소토 선생님", author: "윌리엄 스타이그", publisher: "비룡소",
    titleRoman: "Doctor De Soto (KR ed.)",
    ages: ["5-6","7-9"], level: "그림책",
    themes: ["동물","유머","일상","감정"], mood: ["웃긴","모험"],
    blurb: "생쥐 치과의사가 자기를 잡아먹으려는 여우를 꾀로 따돌리는 통쾌하고 영리한 이야기예요.",
    readAloud: "여우의 음흉한 속셈과 드소토 부부의 작전을 목소리로 대비시켜 보세요.",
    cover: { emoji: "🦷", palette: ["#d98a2b","#cfe0ec"] },
    source: "curated"
  },
  {
    id: "kr-nuneun-jakjiman", lang: "ko",
    title: "프레드릭", author: "레오 리오니", publisher: "시공주니어",
    titleRoman: "Frederick (KR ed.)",
    ages: ["5-6","7-9"], level: "그림책",
    themes: ["동물","감정","자연","친구"], mood: ["잔잔한","따뜻한"],
    blurb: "겨울을 위해 햇살과 색깔과 이야기를 모은 들쥐 프레드릭이 예술의 가치를 잔잔하게 일깨워 줘요.",
    readAloud: "프레드릭이 모은 햇살을 떠올리는 장면에서 잠시 눈을 감고 상상해 보세요.",
    cover: { emoji: "🐭", palette: ["#9b8cb0","#e8c07a"] },
    source: "curated"
  },
  {
    id: "kr-saekkkal-bipa", lang: "ko",
    title: "무지개 물고기", author: "마르쿠스 피스터", publisher: "시공주니어",
    titleRoman: "The Rainbow Fish (KR ed.)",
    ages: ["3-4","5-6"], level: "그림책",
    themes: ["동물","친구","감정","자연"], mood: ["따뜻한","학습"],
    blurb: "반짝이는 비늘을 친구들과 나누며 진짜 행복을 배우는 무지개 물고기 이야기로, 나눔의 기쁨을 알려 줘요.",
    readAloud: "반짝이 비늘을 손끝으로 만지며 \"하나 나눠 줄까?\" 흉내 내 보세요.",
    cover: { emoji: "🐠", palette: ["#3aa0d6","#c0a0e0"] },
    source: "curated"
  },
  {
    id: "kr-uju-danyeo", lang: "ko",
    title: "우주 다녀오겠습니다", author: "장선환", publisher: "딸기책방",
    ages: ["5-6","7-9"], level: "그림책",
    themes: ["우주","환상","모험","자연"], mood: ["모험","학습"],
    blurb: "우주로 떠나는 상상 여행을 한국 그림책 특유의 따뜻한 그림에 담아, 우주를 좋아하는 아이의 호기심을 한껏 채워 줘요.",
    readAloud: "밤하늘 그림을 보며 \"저 별까지 가 볼까?\" 하고 함께 상상해 보세요.",
    cover: { emoji: "🪐", palette: ["#1a2a55","#f2d94e"] },
    source: "curated"
  },
  {
    id: "kr-baekman-mari", lang: "ko",
    title: "백만 마리 고양이", author: "완다 가그", publisher: "시공주니어",
    titleRoman: "Millions of Cats (KR ed.)",
    ages: ["5-6","7-9"], level: "그림책",
    themes: ["동물","숫자/글자","유머","환상"], mood: ["웃긴","잔잔한"],
    blurb: "백만 마리 고양이 중 단 한 마리를 고르는 할아버지 이야기로, 오래도록 사랑받아 온 그림책의 고전이에요.",
    readAloud: "\"백 마리, 천 마리, 백만 마리!\" 후렴을 점점 크게 외쳐 보세요.",
    cover: { emoji: "🐈", palette: ["#5b5b5b","#e8e0c8"] },
    source: "curated"
  },
  {
    id: "kr-juljuri-horangi", lang: "ko",
    title: "줄줄이 꿴 호랑이", author: "권문희", publisher: "사계절",
    ages: ["5-6","7-9"], level: "그림책",
    themes: ["동물","유머","환상","모험"], mood: ["웃긴","모험"],
    blurb: "꾀로 호랑이들을 줄줄이 엮어 버리는 우리 옛이야기로, 반복되는 리듬과 통쾌한 결말이 아이를 사로잡아요.",
    readAloud: "호랑이가 한 마리씩 엮일 때마다 \"또 한 마리!\" 하고 손가락으로 세어 보세요.",
    cover: { emoji: "🐯", palette: ["#b5651d","#e8c07a"] },
    source: "curated"
  },
  {
    id: "kr-naneun-gae", lang: "ko",
    title: "나는 개다", author: "백희나", publisher: "책읽는곰",
    ages: ["3-4","5-6"], level: "그림책",
    themes: ["동물","가족","일상","감정"], mood: ["따뜻한","웃긴"],
    blurb: "강아지 구슬이의 눈으로 바라본 집과 가족 이야기로, 백희나 특유의 입체 인형 그림이 반려견의 마음을 폭 감싸 줘요.",
    readAloud: "구슬이가 가족을 바라보는 장면에서 \"강아지는 무슨 생각을 할까?\" 하고 물어보세요.",
    cover: { emoji: "🐶", palette: ["#e6a23c","#cfe3f0"] },
    source: "curated"
  },
  {
    id: "kr-jageun-jip", lang: "ko",
    title: "괴물들이 사는 나라", author: "모리스 샌닥", publisher: "시공주니어",
    titleRoman: "Where the Wild Things Are (KR ed.)",
    ages: ["3-4","5-6"], level: "그림책",
    themes: ["환상","감정","모험","가족"], mood: ["모험","따뜻한"],
    blurb: "화가 난 맥스가 괴물들의 나라로 떠났다 결국 따뜻한 저녁밥이 기다리는 집으로 돌아오는 마음의 모험이에요.",
    readAloud: "\"괴물 소동을 시작하자!\" 장면에서 함께 발을 구르며 신나게 읽어 보세요.",
    cover: { emoji: "👹", palette: ["#5a7d3c","#e0c98a"] },
    source: "curated"
  },
  {
    id: "kr-eojjeonji", lang: "ko",
    title: "치킨 마스크", author: "우쓰기 미호", publisher: "책읽는곰",
    titleRoman: "(KR ed.)",
    ages: ["5-6","7-9"], level: "그림책",
    themes: ["감정","친구","일상","유머"], mood: ["따뜻한","잔잔한"],
    blurb: "남들과 달라 속상하던 아이가 자기만의 멋을 찾아가는 과정을 통해 \"나다움\"의 소중함을 알려 줘요.",
    readAloud: "\"너는 어떤 게 제일 멋져?\" 하고 아이의 장점을 함께 찾아보세요.",
    cover: { emoji: "🐔", palette: ["#f4c430","#e8595e"] },
    source: "curated"
  },
  {
    id: "kr-batjul", lang: "ko",
    title: "달님 안녕", author: "하야시 아키코", publisher: "한림출판사",
    titleRoman: "Good Night, Moon (Hayashi, KR ed.)",
    ages: ["0-2","3-4"], level: "보드북",
    themes: ["잠자리","자연","일상","가족"], mood: ["잔잔한","따뜻한"],
    blurb: "구름에 가렸다 다시 나타나는 달님에게 인사하는 단순하고 포근한 잠자리 그림책의 대표작이에요.",
    readAloud: "\"달님, 안녕\" 하고 창밖 달을 가리키며 마무리하면 잠들기 좋아요.",
    cover: { emoji: "🌝", palette: ["#2b3a67","#f4d35e"] },
    source: "curated"
  },
  {
    id: "kr-soksak", lang: "ko",
    title: "싹싹싹", author: "하야시 아키코", publisher: "한림출판사",
    titleRoman: "(KR ed.)",
    ages: ["0-2","3-4"], level: "보드북",
    themes: ["일상","음식","동물"], mood: ["잔잔한","따뜻한"],
    blurb: "밥을 깨끗이 비우는 모습을 정겨운 그림으로 보여 주어 아기의 식사 습관에 좋은 첫 보드북이에요.",
    readAloud: "\"싹싹싹\" 소리에 맞춰 숟가락 흉내를 내며 읽어 보세요.",
    cover: { emoji: "🍚", palette: ["#f0e3c2","#e8a04b"] },
    source: "curated"
  },
  {
    id: "kr-momi-ggomjirak", lang: "ko",
    title: "악어도 깜짝, 치과 의사도 깜짝!", author: "고미 타로", publisher: "비룡소",
    titleRoman: "(KR ed.)",
    ages: ["3-4","5-6"], level: "그림책",
    themes: ["동물","유머","일상"], mood: ["웃긴","학습"],
    blurb: "악어와 치과의사가 똑같은 대사를 주고받는 거울 구성으로, 양치와 치과의 두려움을 웃음으로 풀어 줘요.",
    readAloud: "양쪽 페이지를 번갈아 읽으며 같은 말이 반복되는 재미를 느껴 보세요.",
    cover: { emoji: "🐊", palette: ["#5a8f3c","#f4d35e"] },
    source: "curated"
  },
  {
    id: "kr-amuto-mollae", lang: "ko",
    title: "사라, 버스를 타다", author: "윌리엄 밀러", publisher: "사계절",
    titleRoman: "(KR ed.)",
    ages: ["7-9"], level: "그림책",
    themes: ["감정","가족","일상"], mood: ["잔잔한","학습"],
    blurb: "버스 앞자리에 앉고 싶었던 사라의 작은 용기를 통해 평등과 정의의 가치를 아이 눈높이로 전해요.",
    readAloud: "\"왜 사라는 뒤에 앉아야 했을까?\" 하고 함께 생각해 보세요.",
    cover: { emoji: "🚌", palette: ["#c98a3b","#5b5b5b"] },
    source: "curated"
  },
  {
    id: "kr-osori-kkotbat", lang: "ko",
    title: "오소리네 집 꽃밭", author: "권정생", publisher: "길벗어린이",
    ages: ["5-6","7-9"], level: "그림책",
    themes: ["동물","자연","감정","일상"], mood: ["잔잔한","따뜻한"],
    blurb: "들꽃 가득한 오소리네 마당을 권정생 특유의 따뜻한 시선으로 그려, 우리 산과 들의 정겨운 아름다움을 일깨워 줘요.",
    readAloud: "그림 속 들꽃 이름을 하나씩 짚으며 \"이 꽃 본 적 있어?\" 하고 물어보세요.",
    cover: { emoji: "🦡", palette: ["#8a6d3b","#d9c5a0"] },
    source: "curated"
  },

  // ──────────────────────────────────────────────────────────────
  // POOL B — English picture-book canon (blurb/readAloud in Korean for the parent)
  // ──────────────────────────────────────────────────────────────
  {
    id: "en-hungry-caterpillar", lang: "en",
    title: "The Very Hungry Caterpillar", author: "Eric Carle", publisher: "Philomel Books",
    ages: ["0-2","3-4"], level: "보드북",
    themes: ["동물","음식","자연","숫자/글자"], mood: ["학습","따뜻한"],
    blurb: "애벌레가 요일마다 과일을 먹어 치우며 나비가 되는 이야기로, 요일·숫자·색을 자연스럽게 익혀요.",
    readAloud: "구멍 난 과일 페이지에 손가락을 넣어 \"쏙\" 하고 통과시켜 보세요.",
    cover: { emoji: "🐛", palette: ["#5cb85c","#e8595e"] },
    isbn: "9780399226908",
    source: "curated"
  },
  {
    id: "en-brown-bear", lang: "en",
    title: "Brown Bear, Brown Bear, What Do You See?", author: "Bill Martin Jr. & Eric Carle", publisher: "Henry Holt",
    ages: ["0-2","3-4"], level: "보드북",
    themes: ["동물","숫자/글자","자연"], mood: ["학습","잔잔한"],
    blurb: "반복되는 문장과 선명한 색의 동물들이 이어져 아기의 첫 영어 패턴 읽기에 더없이 좋아요.",
    readAloud: "\"What do you see?\"를 부모가 묻고 아이가 다음 동물을 맞히게 해 보세요.",
    cover: { emoji: "🐻", palette: ["#8a5a2b","#e8c07a"] },
    isbn: "9780805047905",
    source: "curated"
  },
  {
    id: "en-goodnight-moon", lang: "en",
    title: "Goodnight Moon", author: "Margaret Wise Brown", publisher: "HarperCollins",
    ages: ["0-2","3-4"], level: "보드북",
    themes: ["잠자리","일상","자연"], mood: ["잔잔한","따뜻한"],
    blurb: "방 안 물건 하나하나에 잘 자라 인사하는 잔잔한 운율이 아기를 스르르 잠들게 하는 잠자리 고전이에요.",
    readAloud: "목소리를 점점 작게 낮춰 마지막엔 속삭이듯 \"goodnight\"으로 마무리해요.",
    cover: { emoji: "🌙", palette: ["#2b6b4f","#f4d35e"] },
    isbn: "9780060275044",
    source: "curated"
  },
  {
    id: "en-gruffalo", lang: "en",
    title: "The Gruffalo", author: "Julia Donaldson & Axel Scheffler", publisher: "Macmillan",
    ages: ["3-4","5-6"], level: "그림책",
    themes: ["동물","환상","모험","유머"], mood: ["모험","웃긴"],
    blurb: "꾀 많은 생쥐가 무서운 괴물 그루팔로를 상상으로 만들어 위기를 넘기는, 운율이 살아 있는 모험담이에요.",
    readAloud: "라임이 많으니 끝 단어를 아이가 따라 말하도록 잠깐 멈춰 주세요.",
    cover: { emoji: "👹", palette: ["#7a5230","#a8c66c"] },
    isbn: "9780333710937",
    source: "curated"
  },
  {
    id: "en-room-on-broom", lang: "en",
    title: "Room on the Broom", author: "Julia Donaldson & Axel Scheffler", publisher: "Macmillan",
    ages: ["3-4","5-6"], level: "그림책",
    themes: ["환상","동물","모험","친구"], mood: ["모험","웃긴"],
    blurb: "마녀의 빗자루에 동물 친구들이 하나둘 올라타며 협동의 힘을 보여 주는 신나는 운율 그림책이에요.",
    readAloud: "빗자루가 점점 무거워지는 만큼 목소리에 힘을 실어 읽어 보세요.",
    cover: { emoji: "🧹", palette: ["#5b3b8a","#e8a04b"] },
    isbn: "9780333903384",
    source: "curated"
  },
  {
    id: "en-stick-man", lang: "en",
    title: "Stick Man", author: "Julia Donaldson & Axel Scheffler", publisher: "Alison Green Books",
    ages: ["3-4","5-6"], level: "그림책",
    themes: ["환상","가족","모험","자연"], mood: ["모험","따뜻한"],
    blurb: "집으로 돌아가려는 막대기 아빠의 모험을 통해 가족의 소중함을 운율 가득한 이야기로 전해요.",
    readAloud: "막대 인간이 이리저리 휩쓸리는 장면에서 책을 함께 흔들어 보세요.",
    cover: { emoji: "🪵", palette: ["#8a5a2b","#a8c66c"] },
    isbn: "9781407124100",
    source: "curated"
  },
  {
    id: "en-snail-whale", lang: "en",
    title: "The Snail and the Whale", author: "Julia Donaldson & Axel Scheffler", publisher: "Macmillan",
    ages: ["3-4","5-6"], level: "그림책",
    themes: ["동물","자연","모험","친구"], mood: ["모험","잔잔한"],
    blurb: "작은 달팽이가 거대한 고래 등에 올라 온 세상을 누비는 여행으로, 작아도 큰일을 해낼 수 있음을 보여 줘요.",
    readAloud: "바다와 빙산, 화산 장면마다 손으로 풍경을 크게 그려 보여 주세요.",
    cover: { emoji: "🐌", palette: ["#3a7ca5","#d9c5a0"] },
    isbn: "9780333982235",
    source: "curated"
  },
  {
    id: "en-wild-things", lang: "en",
    title: "Where the Wild Things Are", author: "Maurice Sendak", publisher: "Harper & Row",
    ages: ["3-4","5-6"], level: "그림책",
    themes: ["환상","감정","모험","가족"], mood: ["모험","따뜻한"],
    blurb: "화가 난 맥스가 괴물 나라의 왕이 되었다 따뜻한 집으로 돌아오는, 아이의 감정을 끌어안는 명작이에요.",
    readAloud: "\"Let the wild rumpus start!\" 장면에서 함께 쿵쿵 발을 굴러요.",
    cover: { emoji: "🐉", palette: ["#5a7d3c","#e0c98a"] },
    isbn: "9780060254926",
    source: "curated"
  },
  {
    id: "en-bear-hunt", lang: "en",
    title: "We're Going on a Bear Hunt", author: "Michael Rosen & Helen Oxenbury", publisher: "Walker Books",
    ages: ["3-4","5-6"], level: "그림책",
    themes: ["모험","가족","자연","동물"], mood: ["모험","웃긴"],
    blurb: "풀밭과 강, 진흙을 헤치며 곰을 찾아 떠나는 가족의 여정이 온몸으로 따라 하기 좋은 리듬으로 펼쳐져요.",
    readAloud: "\"Swishy swashy!\" 같은 의성어를 손동작과 함께 크게 따라 해 보세요.",
    cover: { emoji: "🐻", palette: ["#3a7ca5","#a8c66c"] },
    isbn: "9780744523232",
    source: "curated"
  },
  {
    id: "en-dear-zoo", lang: "en",
    title: "Dear Zoo", author: "Rod Campbell", publisher: "Macmillan",
    ages: ["0-2","3-4"], level: "보드북",
    themes: ["동물","유머","일상"], mood: ["학습","웃긴"],
    blurb: "동물원에 애완동물을 보내 달라 편지를 보내자 도착하는 동물들을 플랩 아래 숨겨 둔 인기 보드북이에요.",
    readAloud: "플랩을 열기 전에 \"무슨 동물일까?\" 하고 아이가 맞히게 해 보세요.",
    cover: { emoji: "🦒", palette: ["#e8a04b","#5cb85c"] },
    isbn: "9780333950135",
    source: "curated"
  },
  {
    id: "en-tiger-tea", lang: "en",
    title: "The Tiger Who Came to Tea", author: "Judith Kerr", publisher: "HarperCollins",
    ages: ["3-4","5-6"], level: "그림책",
    themes: ["동물","음식","가족","환상"], mood: ["웃긴","따뜻한"],
    blurb: "느닷없이 찾아와 집 안 음식을 모두 먹어 치우는 호랑이의 황당하고 다정한 방문기를 그렸어요.",
    readAloud: "호랑이가 음식을 먹을 때마다 \"또 먹어?\" 하고 놀라는 연기를 해 보세요.",
    cover: { emoji: "🐅", palette: ["#e8893c","#f4d35e"] },
    isbn: "9780007215997",
    source: "curated"
  },
  {
    id: "en-guess-love", lang: "en",
    title: "Guess How Much I Love You", author: "Sam McBratney & Anita Jeram", publisher: "Walker Books",
    ages: ["0-2","3-4"], level: "그림책",
    themes: ["가족","감정","동물","자연"], mood: ["따뜻한","잔잔한"],
    blurb: "아기 토끼와 큰 토끼가 사랑의 크기를 겨루는 다정한 잠자리 이야기로, 마음을 표현하는 말을 배워요.",
    readAloud: "팔을 활짝 벌리며 \"이만큼 사랑해\"를 아이와 함께 흉내 내 보세요.",
    cover: { emoji: "🐰", palette: ["#7fb069","#e8c07a"] },
    isbn: "9780763642648",
    source: "curated"
  },
  {
    id: "en-press-here", lang: "en",
    title: "Press Here", author: "Hervé Tullet", publisher: "Chronicle Books",
    ages: ["3-4","5-6"], level: "그림책",
    themes: ["그림그리기","숫자/글자","유머","환상"], mood: ["웃긴","학습"],
    blurb: "점을 누르고 흔들고 부는 대로 다음 장에서 변하는 마법 같은 상호작용으로 아이가 책과 직접 놀아요.",
    readAloud: "지시대로 점을 누르고 책을 흔든 뒤 \"우와, 진짜 변했네!\" 하고 함께 놀라요.",
    cover: { emoji: "🔴", palette: ["#e8595e","#f4d35e"] },
    isbn: "9780811879545",
    source: "curated"
  },
  {
    id: "en-pigeon-bus", lang: "en",
    title: "Don't Let the Pigeon Drive the Bus!", author: "Mo Willems", publisher: "Hyperion Books",
    ages: ["3-4","5-6"], level: "그림책",
    themes: ["유머","감정","탈것","일상"], mood: ["웃긴"],
    blurb: "버스를 몰고 싶어 온갖 떼를 쓰는 비둘기에게 아이가 \"안 돼!\"라고 답하며 깔깔 웃게 되는 책이에요.",
    readAloud: "비둘기가 조를 때마다 아이가 \"No!\"라고 크게 외치게 해 보세요.",
    cover: { emoji: "🐦", palette: ["#3aa0d6","#f4d35e"] },
    isbn: "9780786819881",
    source: "curated"
  },
  {
    id: "en-each-peach", lang: "en",
    title: "Each Peach Pear Plum", author: "Janet & Allan Ahlberg", publisher: "Viking Kestrel",
    ages: ["3-4","5-6"], level: "그림책",
    themes: ["환상","숫자/글자","유머","자연"], mood: ["잔잔한","학습"],
    blurb: "그림 속에 숨은 동화 속 인물을 찾아내는 \"I spy\" 운율 책으로, 관찰력과 영어 라임을 동시에 길러요.",
    readAloud: "\"I spy…\" 다음에 멈춰 아이가 그림 속 인물을 직접 찾게 해 보세요.",
    cover: { emoji: "🍑", palette: ["#e8893c","#a8c66c"] },
    isbn: "9780670286973",
    source: "curated"
  },
  {
    id: "en-very-busy-spider", lang: "en",
    title: "The Very Busy Spider", author: "Eric Carle", publisher: "Philomel Books",
    ages: ["0-2","3-4"], level: "보드북",
    themes: ["동물","자연","일상"], mood: ["잔잔한","학습"],
    blurb: "거미가 묵묵히 거미줄을 완성하는 동안 동물들이 말을 거는 반복 구조로, 집중과 끈기를 보여 줘요.",
    readAloud: "거미줄을 손끝으로 따라 그리며 \"점점 커지네\" 하고 짚어 주세요.",
    cover: { emoji: "🕷️", palette: ["#5b5b5b","#f4d35e"] },
    isbn: "9780399229190",
    source: "curated"
  },
  {
    id: "en-elmer", lang: "en",
    title: "Elmer", author: "David McKee", publisher: "Andersen Press",
    ages: ["3-4","5-6"], level: "그림책",
    themes: ["동물","감정","유머","친구"], mood: ["따뜻한","웃긴"],
    blurb: "알록달록 무늬의 코끼리 엘머가 남과 다른 자신을 받아들이는 이야기로, 다름의 아름다움을 알려 줘요.",
    readAloud: "엘머의 색색 무늬를 손가락으로 짚으며 색 이름을 영어로 함께 말해 보세요.",
    cover: { emoji: "🐘", palette: ["#e8595e","#5cb85c"] },
    isbn: "9781783446667",
    source: "curated"
  },
  {
    id: "en-handa-surprise", lang: "en",
    title: "Handa's Surprise", author: "Eileen Browne", publisher: "Walker Books",
    ages: ["3-4","5-6"], level: "그림책",
    themes: ["동물","음식","자연","유머"], mood: ["웃긴","학습"],
    blurb: "친구에게 과일을 가져가는 동안 동물들이 하나씩 가져가는 줄도 모르는 한다의 이야기가 깜짝 반전을 줘요.",
    readAloud: "한다 뒤에서 동물이 과일을 가져갈 때 아이만 보이는 비밀을 함께 속닥여요.",
    cover: { emoji: "🍌", palette: ["#e8a04b","#5cb85c"] },
    isbn: "9780744536348",
    source: "curated"
  },
  {
    id: "en-very-lonely-firefly", lang: "en",
    title: "The Very Lonely Firefly", author: "Eric Carle", publisher: "Philomel Books",
    ages: ["3-4","5-6"], level: "그림책",
    themes: ["동물","자연","감정","친구"], mood: ["잔잔한","따뜻한"],
    blurb: "친구를 찾아 밤하늘을 헤매는 반딧불이 이야기로, 마지막에 반짝이는 페이지가 감탄을 자아내요.",
    readAloud: "어두운 방에서 마지막 반짝이는 장면을 펼치면 효과가 배가돼요.",
    cover: { emoji: "✨", palette: ["#2b3a67","#f4d35e"] },
    isbn: "9780399504693",
    source: "curated"
  },
  {
    id: "en-mr-gumpy", lang: "en",
    title: "Mr Gumpy's Outing", author: "John Burningham", publisher: "Jonathan Cape",
    ages: ["3-4","5-6"], level: "그림책",
    themes: ["동물","탈것","자연","유머"], mood: ["잔잔한","웃긴"],
    blurb: "검피 아저씨의 작은 배에 동물들이 차례로 올라타다 결국 뒤집히는 유쾌한 강 나들이 이야기예요.",
    readAloud: "배에 동물이 탈 때마다 약속을 거는 부분을 아이와 번갈아 읽어 보세요.",
    cover: { emoji: "⛵", palette: ["#3a7ca5","#e8c07a"] },
    isbn: "9780099408796",
    source: "curated"
  },
  {
    id: "en-rainbow-fish", lang: "en",
    title: "The Rainbow Fish", author: "Marcus Pfister", publisher: "NorthSouth Books",
    ages: ["3-4","5-6"], level: "그림책",
    themes: ["동물","친구","감정","자연"], mood: ["따뜻한","학습"],
    blurb: "반짝 비늘을 나눠 주며 진짜 행복을 찾는 무지개 물고기로, 나눔의 가치를 반짝이는 그림으로 전해요.",
    readAloud: "반짝이는 비늘 페이지를 빛에 비춰 보며 \"예쁘다\" 함께 감탄해 보세요.",
    cover: { emoji: "🐠", palette: ["#3aa0d6","#c0a0e0"] },
    isbn: "9781558580091",
    source: "curated"
  },
  {
    id: "en-gruffalos-child", lang: "en",
    title: "The Gruffalo's Child", author: "Julia Donaldson & Axel Scheffler", publisher: "Macmillan",
    ages: ["3-4","5-6"], level: "그림책",
    themes: ["동물","환상","모험","가족"], mood: ["모험","웃긴"],
    blurb: "겁 없는 그루팔로의 아이가 무서운 생쥐를 찾아 눈 덮인 숲을 헤매는 속편으로, 운율의 재미가 이어져요.",
    readAloud: "눈밭을 헤치는 장면에서 발소리 \"crunch crunch\"를 함께 내 보세요.",
    cover: { emoji: "🌲", palette: ["#3b5a3b","#e0c98a"] },
    isbn: "9781405020459",
    source: "curated"
  },
  {
    id: "en-tooth-fairy", lang: "en",
    title: "Owl Babies", author: "Martin Waddell & Patrick Benson", publisher: "Walker Books",
    ages: ["0-2","3-4"], level: "그림책",
    themes: ["동물","가족","감정","자연"], mood: ["따뜻한","잔잔한"],
    blurb: "엄마를 기다리는 아기 올빼미 삼 남매의 불안과 안도를 통해 분리불안을 다정하게 어루만져요.",
    readAloud: "막내 빌이 \"I want my mummy!\"를 외칠 때 살짝 떨리는 목소리로 읽어 보세요.",
    cover: { emoji: "🦉", palette: ["#3b3b3b","#e8c07a"] },
    isbn: "9780744531671",
    source: "curated"
  },
  {
    id: "en-tiddler", lang: "en",
    title: "Tiddler", author: "Julia Donaldson & Axel Scheffler", publisher: "Alison Green Books",
    ages: ["3-4","5-6"], level: "그림책",
    themes: ["동물","유머","자연","모험"], mood: ["웃긴","모험"],
    blurb: "허풍쟁이 작은 물고기 티들러의 이야기 솜씨가 진짜 위기에서 친구들을 구하는 바닷속 모험담이에요.",
    readAloud: "티들러의 과장된 변명을 점점 더 능청스러운 목소리로 읽어 보세요.",
    cover: { emoji: "🐟", palette: ["#3a7ca5","#f4d35e"] },
    isbn: "9781407109480",
    source: "curated"
  },
  {
    id: "en-knuffle-bunny", lang: "en",
    title: "Knuffle Bunny", author: "Mo Willems", publisher: "Hyperion Books",
    ages: ["3-4","5-6"], level: "그림책",
    themes: ["가족","감정","일상","유머"], mood: ["웃긴","따뜻한"],
    blurb: "빨래방에 토끼 인형을 두고 온 트릭시가 말로 못 하는 답답함을 온몸으로 표현하는 사랑스러운 이야기예요.",
    readAloud: "트릭시가 떼쓰는 \"Aggle flaggle klabble!\"을 신나게 흉내 내 보세요.",
    cover: { emoji: "🐰", palette: ["#6b8e9e","#e8c07a"] },
    isbn: "9780786818709",
    source: "curated"
  },
  {
    id: "en-lost-found", lang: "en",
    title: "Lost and Found", author: "Oliver Jeffers", publisher: "HarperCollins",
    ages: ["3-4","5-6"], level: "그림책",
    themes: ["동물","친구","감정","모험"], mood: ["따뜻한","모험"],
    blurb: "길 잃은 펭귄을 남극까지 데려다주려는 소년의 여정을 통해 진짜 외로움과 우정의 의미를 잔잔히 그려요.",
    readAloud: "노 젓는 장면에서 \"slosh slosh\" 파도 소리를 함께 내 보세요.",
    cover: { emoji: "🐧", palette: ["#3a7ca5","#f0e3c2"] },
    isbn: "9780007150366",
    source: "curated"
  },
  {
    id: "en-how-catch-star", lang: "en",
    title: "How to Catch a Star", author: "Oliver Jeffers", publisher: "HarperCollins",
    ages: ["3-4","5-6"], level: "그림책",
    themes: ["우주","자연","감정","환상"], mood: ["잔잔한","따뜻한"],
    blurb: "별을 갖고 싶은 아이가 온갖 방법을 궁리하는 이야기로, 꿈과 끈기를 따뜻한 그림으로 담았어요.",
    readAloud: "밤하늘을 올려다보는 마음으로 천천히 읽어 잔잔함을 살려 주세요.",
    cover: { emoji: "⭐", palette: ["#2b3a67","#f4d35e"] },
    isbn: "9780007150342",
    source: "curated"
  },
  {
    id: "en-incredible-book-eating", lang: "en",
    title: "The Incredible Book Eating Boy", author: "Oliver Jeffers", publisher: "HarperCollins",
    ages: ["5-6","7-9"], level: "그림책",
    themes: ["유머","숫자/글자","환상","일상"], mood: ["웃긴","학습"],
    blurb: "책을 먹어 똑똑해지려던 소년이 결국 책 읽는 즐거움을 발견하는, 책 사랑을 일깨우는 유쾌한 이야기예요.",
    readAloud: "\"책을 먹으면 어떨까?\" 하고 엉뚱한 상상을 아이와 함께 펼쳐 보세요.",
    cover: { emoji: "📚", palette: ["#b5651d","#e8c07a"] },
    isbn: "9780007182329",
    source: "curated"
  },
  {
    id: "en-pout-pout-fish", lang: "en",
    title: "The Pout-Pout Fish", author: "Deborah Diesen & Dan Hanna", publisher: "Farrar Straus Giroux",
    ages: ["3-4","5-6"], level: "그림책",
    themes: ["동물","감정","자연","유머"], mood: ["따뜻한","웃긴"],
    blurb: "늘 시무룩한 물고기가 웃음을 되찾는 이야기로, 운율을 따라 읽으며 감정을 표현하는 법을 배워요.",
    readAloud: "\"blub blub blub\" 후렴을 아이와 입을 쭉 내밀고 함께 외쳐 보세요.",
    cover: { emoji: "🐡", palette: ["#3a7ca5","#e8a04b"] },
    isbn: "9780374360979",
    source: "curated"
  },
  {
    id: "en-dont-feed-the-bear", lang: "en",
    title: "We Don't Eat Our Classmates", author: "Ryan T. Higgins", publisher: "Disney-Hyperion",
    ages: ["3-4","5-6"], level: "그림책",
    themes: ["공룡","친구","감정","유머"], mood: ["웃긴","따뜻한"],
    blurb: "반 친구를 먹고 싶은 공룡 페넬로페가 우정을 배우는 이야기로, 학교 적응과 공감을 웃음으로 풀어 줘요.",
    readAloud: "페넬로페가 친구를 덥석 무는 장면에서 \"안 돼!\" 하고 같이 말려 보세요.",
    cover: { emoji: "🦕", palette: ["#5cb85c","#e8595e"] },
    isbn: "9781368003551",
    source: "curated"
  },
  {
    id: "en-not-a-box", lang: "en",
    title: "Not a Box", author: "Antoinette Portis", publisher: "HarperCollins",
    ages: ["3-4","5-6"], level: "그림책",
    themes: ["환상","그림그리기","유머","일상"], mood: ["웃긴","학습"],
    blurb: "그냥 상자가 아니라 자동차도 로켓도 되는 토끼의 상상력을 통해 아이의 창의력을 톡톡 건드려요.",
    readAloud: "\"이 상자는 뭐가 될 수 있을까?\" 하고 집 안 상자로 직접 놀아 보세요.",
    cover: { emoji: "📦", palette: ["#c98a3b","#e8595e"] },
    isbn: "9780061123221",
    source: "curated"
  },
  {
    id: "en-giraffes-cant-dance", lang: "en",
    title: "Giraffes Can't Dance", author: "Giles Andreae & Guy Parker-Rees", publisher: "Orchard Books",
    ages: ["3-4","5-6"], level: "그림책",
    themes: ["동물","감정","친구","유머"], mood: ["따뜻한","웃긴"],
    blurb: "춤 못 추는 기린 제럴드가 자기만의 음악을 찾아 멋지게 춤추는 이야기로, 자신감을 북돋아 줘요.",
    readAloud: "마지막 제럴드가 춤추는 장면에서 아이와 함께 일어나 춤춰 보세요.",
    cover: { emoji: "🦒", palette: ["#e8a04b","#7fb069"] },
    isbn: "9781841215655",
    source: "curated"
  },
  {
    id: "en-tree-house", lang: "en",
    title: "The Day the Crayons Quit", author: "Drew Daywalt & Oliver Jeffers", publisher: "Philomel Books",
    ages: ["5-6","7-9"], level: "그림책",
    themes: ["그림그리기","감정","유머","숫자/글자"], mood: ["웃긴","따뜻한"],
    blurb: "파업을 선언한 크레용들의 편지로 이야기가 펼쳐져, 색과 감정 표현을 유쾌하게 배우게 해요.",
    readAloud: "크레용마다 다른 성격이 드러나도록 색깔별로 목소리를 바꿔 읽어 보세요.",
    cover: { emoji: "🖍️", palette: ["#e8595e","#3aa0d6"] },
    isbn: "9780399255373",
    source: "curated"
  },
  {
    id: "en-tiny-seed", lang: "en",
    title: "The Tiny Seed", author: "Eric Carle", publisher: "Simon & Schuster",
    ages: ["3-4","5-6"], level: "그림책",
    themes: ["자연","감정","숫자/글자"], mood: ["잔잔한","학습"],
    blurb: "작은 씨앗 하나가 사계절을 거쳐 큰 꽃으로 자라는 과정을 통해 생명의 순환을 아름답게 보여 줘요.",
    readAloud: "씨앗이 바람에 날리는 장면에서 후 불며 함께 날려 보세요.",
    cover: { emoji: "🌱", palette: ["#6aa84f","#e8c07a"] },
    isbn: "9780689842443",
    source: "curated"
  },
  {
    id: "en-monkey-puzzle", lang: "en",
    title: "Monkey Puzzle", author: "Julia Donaldson & Axel Scheffler", publisher: "Macmillan",
    ages: ["3-4","5-6"], level: "그림책",
    themes: ["동물","가족","모험","유머"], mood: ["모험","따뜻한"],
    blurb: "엄마를 잃어버린 아기 원숭이가 나비와 함께 엄마를 찾아 나서는 운율 가득한 정글 모험이에요.",
    readAloud: "나비가 엉뚱한 동물을 데려올 때마다 \"이게 엄마야?\" 하고 함께 웃어요.",
    cover: { emoji: "🐒", palette: ["#5a8f3c","#e8a04b"] },
    isbn: "9780333720011",
    source: "curated"
  },
  {
    id: "en-zog", lang: "en",
    title: "Zog", author: "Julia Donaldson & Axel Scheffler", publisher: "Alison Green Books",
    ages: ["3-4","5-6"], level: "그림책",
    themes: ["환상","모험","친구","유머"], mood: ["모험","웃긴"],
    blurb: "용 학교에서 늘 실수투성이인 조그가 친절한 공주를 만나 자기 길을 찾는 운율 가득한 모험담이에요.",
    readAloud: "조그가 다치는 장면마다 \"아야!\" 하고 함께 안타까워해 주세요.",
    cover: { emoji: "🐲", palette: ["#5cb85c","#e8a04b"] },
    isbn: "9781407115573",
    source: "curated"
  },
  {
    id: "en-naughty-bus", lang: "en",
    title: "Naughty Bus", author: "Jan Oke & Jerry Oke", publisher: "Little Knowall",
    ages: ["3-4","5-6"], level: "그림책",
    themes: ["탈것","자동차","유머","모험"], mood: ["웃긴","모험"],
    blurb: "장난감 빨간 버스가 집 안 곳곳을 누비며 사고를 치는 이야기로, 탈것 좋아하는 아이가 푹 빠져요.",
    readAloud: "버스가 \"붕\" 달리고 \"첨벙\" 빠지는 효과음을 신나게 넣어 읽어 보세요.",
    cover: { emoji: "🚌", palette: ["#e8595e","#f4d35e"] },
    isbn: "9780954792114",
    source: "curated"
  },
  {
    id: "en-dinosaurs-love", lang: "en",
    title: "Dinosaurs Love Underpants", author: "Claire Freedman & Ben Cort", publisher: "Simon & Schuster",
    ages: ["3-4","5-6"], level: "그림책",
    themes: ["공룡","유머","환상"], mood: ["웃긴","모험"],
    blurb: "공룡이 멸종한 진짜 이유가 팬티 쟁탈전이라는 엉뚱한 상상으로 아이들을 자지러지게 웃겨요.",
    readAloud: "\"underpants!\"가 나올 때마다 아이가 큰 소리로 외치게 해 보세요.",
    cover: { emoji: "🦖", palette: ["#5cb85c","#3aa0d6"] },
    isbn: "9781416988502",
    source: "curated"
  },
  {
    id: "en-hairy-maclary", lang: "en",
    title: "Hairy Maclary from Donaldson's Dairy", author: "Lynley Dodd", publisher: "Mallinson Rendel",
    ages: ["3-4","5-6"], level: "그림책",
    themes: ["동물","유머","자연","일상"], mood: ["웃긴","모험"],
    blurb: "동네 개들을 이끌고 거리를 누비던 헤어리 매클레리가 고양이 한 마리에 혼비백산하는 운율 코미디예요.",
    readAloud: "개 이름이 줄줄이 이어지는 후렴을 리듬을 타며 빠르게 읽어 보세요.",
    cover: { emoji: "🐕", palette: ["#5b5b5b","#e8c07a"] },
    isbn: "9780140509380",
    source: "curated"
  },
  {
    id: "en-aliens-underpants", lang: "en",
    title: "Aliens Love Underpants", author: "Claire Freedman & Ben Cort", publisher: "Simon & Schuster",
    ages: ["3-4","5-6"], level: "그림책",
    themes: ["우주","유머","환상","모험"], mood: ["웃긴","모험"],
    blurb: "팬티를 모으러 지구에 오는 외계인들의 엉뚱한 이야기로, 우주와 웃음을 동시에 좋아하는 아이에게 딱이에요.",
    readAloud: "외계인 우주선이 착륙하는 장면을 \"삐용삐용\" 효과음으로 살려 보세요.",
    cover: { emoji: "👽", palette: ["#7fb069","#a0d8ef"] },
    isbn: "9781416917045",
    source: "curated"
  },
  {
    id: "en-rosie-walk", lang: "en",
    title: "Rosie's Walk", author: "Pat Hutchins", publisher: "Macmillan",
    ages: ["0-2","3-4"], level: "그림책",
    themes: ["동물","유머","자연","일상"], mood: ["웃긴","잔잔한"],
    blurb: "암탉 로지가 산책하는 동안 뒤에서 쫓던 여우가 줄줄이 사고를 당하는, 글과 그림의 반전이 재미있는 책이에요.",
    readAloud: "글에 없는 여우의 수난을 그림에서 찾아 \"어, 여우 봐!\" 하고 짚어 주세요.",
    cover: { emoji: "🐔", palette: ["#e8a04b","#7fb069"] },
    isbn: "9780020437505",
    source: "curated"
  },
  {
    id: "en-snowman", lang: "en",
    title: "The Snowman", author: "Raymond Briggs", publisher: "Hamish Hamilton",
    ages: ["3-4","5-6"], level: "그림책",
    themes: ["환상","자연","모험","감정"], mood: ["잔잔한","모험"],
    blurb: "눈사람과 하늘을 나는 소년의 환상적인 밤을 글 없이 그림만으로 그린, 겨울의 고전이에요.",
    readAloud: "글이 없으니 그림을 보며 둘이서 이야기를 만들어 읽어 보세요.",
    cover: { emoji: "⛄", palette: ["#3a5a8a","#eef3f6"] },
    isbn: "9780241302651",
    source: "curated"
  },
  {
    id: "en-very-quiet-cricket", lang: "en",
    title: "The Very Quiet Cricket", author: "Eric Carle", publisher: "Philomel Books",
    ages: ["3-4","5-6"], level: "그림책",
    themes: ["동물","자연","감정","음식"], mood: ["잔잔한","학습"],
    blurb: "소리를 내지 못하던 귀뚜라미가 마침내 노래하게 되는 이야기로, 마지막 페이지의 실제 소리가 깜짝 선물이에요.",
    readAloud: "여러 곤충의 울음소리를 입으로 흉내 내며 등장시켜 보세요.",
    cover: { emoji: "🦗", palette: ["#5a8f3c","#e8c07a"] },
    isbn: "9780399226847",
    source: "curated"
  },
  {
    id: "en-windy-day", lang: "en",
    title: "Oi Frog!", author: "Kes Gray & Jim Field", publisher: "Hodder Children's Books",
    ages: ["3-4","5-6"], level: "그림책",
    themes: ["동물","유머","숫자/글자"], mood: ["웃긴","학습"],
    blurb: "어떤 동물이 어디에 앉아야 하는지 라임으로 정해 주는 고양이와 개구리의 말장난이 아이의 영어 라임 감각을 키워요.",
    readAloud: "라임 단어 앞에서 멈춰 아이가 어울리는 단어를 맞히게 해 보세요.",
    cover: { emoji: "🐸", palette: ["#5cb85c","#e8595e"] },
    isbn: "9781444910865",
    source: "curated"
  }
];
