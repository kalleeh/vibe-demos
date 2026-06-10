/* 책친구 catalog — append-only book data. See CATALOG.md for the schema.
 * Generated/expanded by scripts/kids-bookshelf/build-catalog.mjs (node build-catalog.mjs emit).
 * Every field except titleRoman/isbn is required. quality (0-1) = build-time prior. */
window.THEME_VOCAB = ["공룡","우주","동물","공주","자동차","탈것","그림그리기","잠자리","자연","음식","가족","친구","감정","일상","환상","모험","숫자/글자","유머"];
window.MOOD_VOCAB  = ["웃긴","따뜻한","모험","학습","잔잔한"];
window.BOOKS = [
 {
  "id": "kr-gureumppang",
  "lang": "ko",
  "title": "구름빵",
  "author": "백희나",
  "publisher": "한솔수북",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "환상",
   "가족",
   "음식",
   "일상"
  ],
  "mood": [
   "따뜻한",
   "잔잔한"
  ],
  "blurb": "비 오는 날 구름으로 만든 빵을 먹고 하늘을 나는 남매 이야기로, 백희나 특유의 입체 사진 그림이 환상적이에요.",
  "readAloud": "빵을 먹고 둥실 떠오르는 장면에서 아이를 살짝 안아 올려 보세요.",
  "cover": {
   "emoji": "🍞",
   "palette": [
    "#cfe3f0",
    "#e8c98a"
   ]
  },
  "source": "curated",
  "quality": 0.7
 },
 {
  "id": "kr-dal-sherbet",
  "lang": "ko",
  "title": "달 샤베트",
  "author": "백희나",
  "publisher": "책읽는곰",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "환상",
   "자연",
   "가족"
  ],
  "mood": [
   "잔잔한",
   "따뜻한"
  ],
  "blurb": "무더운 여름밤 녹아내린 달을 받아 샤베트로 만든 반장 할머니의 따뜻한 상상력이 빛나요.",
  "readAloud": "더운 여름밤 불을 끄고 읽으면 달빛 분위기가 살아나요.",
  "cover": {
   "emoji": "🌙",
   "palette": [
    "#2b3a67",
    "#f2d680"
   ]
  },
  "source": "curated",
  "quality": 0.7
 },
 {
  "id": "kr-alsatang",
  "lang": "ko",
  "title": "알사탕",
  "author": "백희나",
  "publisher": "책읽는곰",
  "ages": [
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "감정",
   "친구",
   "가족",
   "환상"
  ],
  "mood": [
   "따뜻한",
   "잔잔한"
  ],
  "blurb": "마음의 소리가 들리는 알사탕을 먹은 동동이가 아빠와 친구의 진심을 듣게 되는 이야기예요.",
  "readAloud": "알사탕을 하나씩 먹을 때마다 들리는 목소리를 다른 톤으로 연기해 보세요.",
  "cover": {
   "emoji": "🍬",
   "palette": [
    "#e85d75",
    "#f6c453"
   ]
  },
  "source": "curated",
  "quality": 0.7
 },
 {
  "id": "kr-jangsutang",
  "lang": "ko",
  "title": "장수탕 선녀님",
  "author": "백희나",
  "publisher": "책읽는곰",
  "ages": [
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "환상",
   "가족",
   "일상"
  ],
  "mood": [
   "따뜻한",
   "웃긴"
  ],
  "blurb": "오래된 목욕탕 장수탕에서 만난 선녀 할머니와 덕지의 우정을 정겨운 한국 정서로 그렸어요.",
  "readAloud": "냉탕에 들어가는 장면에서 \"으악, 차가워!\" 하고 함께 소리쳐 보세요.",
  "cover": {
   "emoji": "🛁",
   "palette": [
    "#9fd3c7",
    "#e6e6e6"
   ]
  },
  "source": "curated",
  "quality": 0.7
 },
 {
  "id": "kr-isanghan-eomma",
  "lang": "ko",
  "title": "이상한 엄마",
  "author": "백희나",
  "publisher": "책읽는곰",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "가족",
   "환상",
   "감정",
   "일상"
  ],
  "mood": [
   "따뜻한",
   "잔잔한"
  ],
  "blurb": "아픈 호호를 돌봐 줄 사람을 찾다 잘못 걸려온 하늘나라 선녀가 엄마가 되어 주는 포근한 이야기예요.",
  "readAloud": "구름으로 만든 달걀부침 장면을 아이와 함께 상상하며 읽어 보세요.",
  "cover": {
   "emoji": "🍳",
   "palette": [
    "#bcd4e6",
    "#f4e1a0"
   ]
  },
  "source": "curated",
  "quality": 0.7
 },
 {
  "id": "kr-gangaji-ddong",
  "lang": "ko",
  "title": "강아지똥",
  "author": "권정생",
  "publisher": "길벗어린이",
  "ages": [
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "자연",
   "감정",
   "친구"
  ],
  "mood": [
   "따뜻한",
   "잔잔한"
  ],
  "blurb": "보잘것없어 보이던 강아지똥이 민들레꽃을 피우며 세상에 쓸모없는 존재는 없다는 걸 알려 줘요.",
  "readAloud": "마지막 민들레가 피는 장면에서 잠시 멈춰 \"강아지똥이 어떻게 됐을까?\" 물어보세요.",
  "cover": {
   "emoji": "🌼",
   "palette": [
    "#a8763e",
    "#f2d94e"
   ]
  },
  "source": "curated",
  "quality": 0.7
 },
 {
  "id": "kr-mongsil-eonni",
  "lang": "ko",
  "title": "몽실 언니",
  "author": "권정생",
  "publisher": "창비",
  "ages": [
   "7-9"
  ],
  "level": "초기챕터북",
  "themes": [
   "가족",
   "감정",
   "일상"
  ],
  "mood": [
   "잔잔한",
   "따뜻한"
  ],
  "blurb": "전쟁과 가난 속에서도 동생을 보살피는 몽실이의 강인함이 깊은 울림을 주는 한국 동화예요.",
  "readAloud": "조금 긴 이야기이니 하루 한 장씩 나눠 읽으며 몽실이 마음을 함께 이야기해 보세요.",
  "cover": {
   "emoji": "👧",
   "palette": [
    "#8a6d3b",
    "#d9c5a0"
   ]
  },
  "source": "curated",
  "quality": 0.7
 },
 {
  "id": "kr-geurimja-nori",
  "lang": "ko",
  "title": "그림자놀이",
  "author": "이수지",
  "publisher": "비룡소",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "환상",
   "그림그리기",
   "일상"
  ],
  "mood": [
   "잔잔한",
   "학습"
  ],
  "blurb": "불을 켜자 살아나는 그림자들이 펼치는 글 없는 그림책으로, 상상의 세계가 페이지마다 자라나요.",
  "readAloud": "글이 없으니 아이가 그림을 보며 직접 이야기를 지어내게 해 보세요.",
  "cover": {
   "emoji": "🌑",
   "palette": [
    "#f2c94c",
    "#1a1a1a"
   ]
  },
  "source": "curated",
  "quality": 0.7
 },
 {
  "id": "kr-pado-ya",
  "lang": "ko",
  "title": "파도야 놀자",
  "author": "이수지",
  "publisher": "비룡소",
  "ages": [
   "0-2",
   "3-4"
  ],
  "level": "그림책",
  "themes": [
   "자연",
   "감정",
   "일상"
  ],
  "mood": [
   "잔잔한"
  ],
  "blurb": "바닷가에서 파도와 밀고 당기며 노는 아이의 마음을 파랑과 흑백만으로 시원하게 담은 글 없는 그림책이에요.",
  "readAloud": "파도가 밀려올 때 \"와아\" 하고 손으로 파도를 그려 보여 주세요.",
  "cover": {
   "emoji": "🌊",
   "palette": [
    "#3aa0d6",
    "#eef3f6"
   ]
  },
  "source": "curated",
  "quality": 0.7
 },
 {
  "id": "kr-subak-suyeong",
  "lang": "ko",
  "title": "수박 수영장",
  "author": "안녕달",
  "publisher": "창비",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "음식",
   "환상",
   "일상",
   "자연"
  ],
  "mood": [
   "웃긴",
   "잔잔한"
  ],
  "blurb": "거대한 수박이 수영장이 되는 무더운 여름날의 상상으로, 시원함과 즐거움이 가득해요.",
  "readAloud": "수박물에 풍덩 빠지는 장면에서 \"첨벙!\" 효과음을 함께 내 보세요.",
  "cover": {
   "emoji": "🍉",
   "palette": [
    "#e34b54",
    "#3aaf5c"
   ]
  },
  "source": "curated",
  "quality": 0.7
 },
 {
  "id": "kr-halmeoni-yeoreum",
  "lang": "ko",
  "title": "할머니의 여름휴가",
  "author": "안녕달",
  "publisher": "창비",
  "ages": [
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "가족",
   "자연",
   "환상"
  ],
  "mood": [
   "잔잔한",
   "따뜻한"
  ],
  "blurb": "손주가 주워 온 소라 껍데기에서 흘러나온 바다로 떠나는 할머니의 여름휴가가 잔잔한 위로를 줘요.",
  "readAloud": "소라를 귀에 대면 바다 소리가 들린다고 알려 주고 함께 흉내 내 보세요.",
  "cover": {
   "emoji": "🐚",
   "palette": [
    "#6db5c7",
    "#f0e3c2"
   ]
  },
  "source": "curated",
  "quality": 0.7
 },
 {
  "id": "kr-sol-chuseok",
  "lang": "ko",
  "title": "솔이의 추석 이야기",
  "author": "이억배",
  "publisher": "길벗어린이",
  "ages": [
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "가족",
   "일상",
   "자연"
  ],
  "mood": [
   "따뜻한",
   "잔잔한"
  ],
  "blurb": "추석을 맞아 고향에 내려가는 솔이네 가족의 모습으로 우리 명절 풍경을 정겹게 담았어요.",
  "readAloud": "그림 속 시골 길과 차례상을 가리키며 우리 가족 명절 이야기를 들려주세요.",
  "cover": {
   "emoji": "🌕",
   "palette": [
    "#c98a3b",
    "#f2dca0"
   ]
  },
  "source": "curated",
  "quality": 0.7
 },
 {
  "id": "kr-sonkeun-halmeoni",
  "lang": "ko",
  "title": "손 큰 할머니의 만두 만들기",
  "author": "채인선",
  "publisher": "재미마주",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "가족",
   "음식",
   "일상",
   "동물"
  ],
  "mood": [
   "따뜻한",
   "웃긴"
  ],
  "blurb": "설을 앞두고 산더미처럼 만두를 빚는 손 큰 할머니와 동물들의 흥겨운 만두 잔치예요.",
  "readAloud": "만두 빚는 시늉을 손으로 함께 하며 읽으면 더 신나요.",
  "cover": {
   "emoji": "🥟",
   "palette": [
    "#e8b04b",
    "#f6efe2"
   ]
  },
  "source": "curated",
  "quality": 0.7
 },
 {
  "id": "kr-jigak-john",
  "lang": "ko",
  "title": "지각대장 존",
  "author": "존 버닝햄",
  "publisher": "비룡소",
  "titleRoman": "John Patrick Norman McHennessy (KR ed.)",
  "ages": [
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "유머",
   "환상",
   "일상",
   "모험"
  ],
  "mood": [
   "웃긴",
   "모험"
  ],
  "blurb": "학교 가는 길에 악어와 사자를 만나 늘 지각하는 존의 이야기로, 어른의 불신을 유쾌하게 꼬집어요.",
  "readAloud": "선생님의 호통과 존의 변명을 서로 다른 목소리로 연기해 보세요.",
  "cover": {
   "emoji": "🐊",
   "palette": [
    "#5a8f3c",
    "#e8d49a"
   ]
  },
  "source": "curated",
  "quality": 0.7
 },
 {
  "id": "kr-yonggamhan-irene",
  "lang": "ko",
  "title": "용감한 아이린",
  "author": "윌리엄 스타이그",
  "publisher": "웅진주니어",
  "titleRoman": "Brave Irene (KR ed.)",
  "ages": [
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "모험",
   "가족",
   "감정",
   "자연"
  ],
  "mood": [
   "모험",
   "따뜻한"
  ],
  "blurb": "아픈 엄마 대신 눈보라를 뚫고 드레스를 배달하는 아이린의 용기가 가슴을 뭉클하게 해요.",
  "readAloud": "바람이 거세지는 장면에서 목소리를 점점 크게 해 긴장감을 살려 보세요.",
  "cover": {
   "emoji": "❄️",
   "palette": [
    "#cfe0ec",
    "#d65a5a"
   ]
  },
  "source": "curated",
  "quality": 0.7
 },
 {
  "id": "kr-gwaenchana",
  "lang": "ko",
  "title": "괜찮아",
  "author": "최숙희",
  "publisher": "웅진주니어",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "감정",
   "동물",
   "일상"
  ],
  "mood": [
   "따뜻한",
   "학습"
  ],
  "blurb": "느려도, 작아도, 못해도 \"괜찮아\"라고 다독여 주며 아이의 자존감을 따뜻하게 키워 줘요.",
  "readAloud": "한 장면마다 아이를 보며 \"괜찮아\" 하고 함께 말해 주세요.",
  "cover": {
   "emoji": "🤗",
   "palette": [
    "#f4b6c2",
    "#fff3e0"
   ]
  },
  "source": "curated",
  "quality": 0.7
 },
 {
  "id": "kr-eomma-majung",
  "lang": "ko",
  "title": "엄마 마중",
  "author": "이태준",
  "publisher": "보림",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "가족",
   "감정",
   "일상"
  ],
  "mood": [
   "잔잔한",
   "따뜻한"
  ],
  "blurb": "전차 정류장에서 엄마를 기다리는 아기의 모습을 옛 그림으로 담은, 기다림의 정서가 깊은 그림책이에요.",
  "readAloud": "\"엄마 안 와?\" 하고 묻는 아기 마음을 함께 천천히 따라가 보세요.",
  "cover": {
   "emoji": "🚋",
   "palette": [
    "#b5651d",
    "#efe6d3"
   ]
  },
  "source": "curated",
  "quality": 0.7
 },
 {
  "id": "kr-go-nyeoseok",
  "lang": "ko",
  "title": "고 녀석 맛있겠다",
  "author": "미야니시 타츠야",
  "publisher": "달리",
  "titleRoman": "You Are Umasou (KR ed.)",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "공룡",
   "가족",
   "감정",
   "모험"
  ],
  "mood": [
   "따뜻한",
   "모험"
  ],
  "blurb": "잡아먹으려던 아기 공룡을 아들로 키우게 된 티라노사우루스의 뭉클한 부정을 그린 인기 공룡 그림책이에요.",
  "readAloud": "사나운 공룡 목소리와 아기 공룡 \"아빠!\" 목소리를 대비시켜 읽어 보세요.",
  "cover": {
   "emoji": "🦖",
   "palette": [
    "#3f7d3f",
    "#e6a23c"
   ]
  },
  "source": "curated",
  "quality": 0.7
 },
 {
  "id": "kr-doseogwan-saja",
  "lang": "ko",
  "title": "도서관에 간 사자",
  "author": "미셸 누드슨",
  "publisher": "웅진주니어",
  "titleRoman": "Library Lion (KR ed.)",
  "ages": [
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "동물",
   "친구",
   "일상",
   "감정"
  ],
  "mood": [
   "따뜻한",
   "웃긴"
  ],
  "blurb": "도서관 규칙을 지키며 모두의 친구가 된 사자가 규칙과 마음 사이에서 진짜 중요한 게 뭔지 보여 줘요.",
  "readAloud": "도서관에서는 작게 말해야 한다고 속삭이듯 읽다가 사자가 포효하는 장면에서 살짝 크게!",
  "cover": {
   "emoji": "🦁",
   "palette": [
    "#d98a2b",
    "#efe2c2"
   ]
  },
  "source": "curated",
  "quality": 0.7
 },
 {
  "id": "kr-baekgu",
  "lang": "ko",
  "title": "백구",
  "author": "김민기",
  "publisher": "사계절",
  "ages": [
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "동물",
   "가족",
   "감정"
  ],
  "mood": [
   "잔잔한",
   "따뜻한"
  ],
  "blurb": "한 아이와 흰둥이 백구가 함께 자라며 나누는 우정과 이별을 노랫말처럼 잔잔하게 그렸어요.",
  "readAloud": "원곡 노래 '백구'를 함께 흥얼거리며 읽으면 감동이 배가돼요.",
  "cover": {
   "emoji": "🐕",
   "palette": [
    "#e8e2d4",
    "#9a8f7a"
   ]
  },
  "source": "curated",
  "quality": 0.7
 },
 {
  "id": "kr-assibang",
  "lang": "ko",
  "title": "아씨방 일곱 동무",
  "author": "이영경",
  "publisher": "비룡소",
  "ages": [
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "일상",
   "유머",
   "환상"
  ],
  "mood": [
   "웃긴",
   "학습"
  ],
  "blurb": "바늘·실·가위·자·골무·인두·다리미 일곱 바느질 동무가 서로 제일이라 다투는 우리 옛이야기로, 옛 살림살이를 정겹게 만나요.",
  "readAloud": "바느질 도구를 하나씩 가리키며 \"이건 뭐 하는 물건일까?\" 하고 물어보세요.",
  "cover": {
   "emoji": "🧵",
   "palette": [
    "#c44a52",
    "#f0d59a"
   ]
  },
  "source": "curated",
  "quality": 0.7
 },
 {
  "id": "kr-nuga-naui-seulpeum",
  "lang": "ko",
  "title": "누가 내 머리에 똥 쌌어?",
  "author": "베르너 홀츠바르트",
  "publisher": "사계절",
  "titleRoman": "The Story of the Little Mole (KR ed.)",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "동물",
   "유머",
   "일상"
  ],
  "mood": [
   "웃긴",
   "학습"
  ],
  "blurb": "머리에 똥을 맞은 두더지가 범인을 찾아 나서는 유쾌한 추리로, 아이들이 깔깔 웃으며 동물 똥을 배워요.",
  "readAloud": "동물들의 똥 모양을 비교하는 장면에서 \"이건 누구 똥일까?\" 퀴즈를 내 보세요.",
  "cover": {
   "emoji": "💩",
   "palette": [
    "#8a6d3b",
    "#cbe3a0"
   ]
  },
  "source": "curated",
  "quality": 0.7
 },
 {
  "id": "kr-geumbungeo",
  "lang": "ko",
  "title": "금붕어가 달아나네",
  "author": "고미 타로",
  "publisher": "한림출판사",
  "titleRoman": "Where's the Fish? (KR ed.)",
  "ages": [
   "0-2",
   "3-4"
  ],
  "level": "보드북",
  "themes": [
   "동물",
   "일상",
   "유머"
  ],
  "mood": [
   "웃긴",
   "잔잔한"
  ],
  "blurb": "달아난 금붕어가 비슷하게 생긴 물건들 사이에 숨는 숨은그림찾기 구성으로, 아기가 손끝으로 짚으며 까르르 즐겨요.",
  "readAloud": "페이지마다 \"금붕어 어디 있지?\" 하고 아이가 직접 찾게 해 보세요.",
  "cover": {
   "emoji": "🐟",
   "palette": [
    "#f4c430",
    "#e85d75"
   ]
  },
  "source": "curated",
  "quality": 0.7
 },
 {
  "id": "kr-aegyo-jeonseol",
  "lang": "ko",
  "title": "이파라파냐무냐무",
  "author": "이지은",
  "publisher": "사계절",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "친구",
   "감정",
   "유머",
   "환상"
  ],
  "mood": [
   "웃긴",
   "따뜻한"
  ],
  "blurb": "무섭게만 보였던 솜털 괴물과 마시멜로들이 오해를 풀고 친구가 되는 과정을 통통 튀는 말맛으로 그렸어요.",
  "readAloud": "\"이파라파냐무냐무\" 주문을 아이와 함께 큰 소리로 외쳐 보세요.",
  "cover": {
   "emoji": "👾",
   "palette": [
    "#f4a6c0",
    "#a0d8ef"
   ]
  },
  "source": "curated",
  "quality": 0.7
 },
 {
  "id": "kr-doldol",
  "lang": "ko",
  "title": "팥죽 할멈과 호랑이",
  "author": "박윤규",
  "publisher": "시공주니어",
  "ages": [
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "환상",
   "유머",
   "음식",
   "동물"
  ],
  "mood": [
   "웃긴",
   "모험"
  ],
  "blurb": "호랑이를 물리치려 팥죽 할멈을 돕는 알밤, 자라, 송곳, 멍석의 활약을 그린 우리 전래동화예요.",
  "readAloud": "알밤이 튀고 자라가 무는 장면마다 \"퍽! 콱!\" 효과음을 넣어 읽어 보세요.",
  "cover": {
   "emoji": "🐯",
   "palette": [
    "#b5651d",
    "#e8c07a"
   ]
  },
  "source": "curated",
  "quality": 0.7
 },
 {
  "id": "kr-kkachi",
  "lang": "ko",
  "title": "팥이 영감과 우르르 산토끼",
  "author": "박재철",
  "publisher": "길벗어린이",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "동물",
   "유머",
   "일상"
  ],
  "mood": [
   "웃긴",
   "잔잔한"
  ],
  "blurb": "우리 옛이야기 특유의 반복과 리듬이 살아 있어 아이가 다음 장면을 예측하며 즐기게 돼요.",
  "readAloud": "반복되는 후렴을 아이가 따라 말하도록 잠깐씩 멈춰 주세요.",
  "cover": {
   "emoji": "🐰",
   "palette": [
    "#c98a3b",
    "#e8e0c8"
   ]
  },
  "source": "curated",
  "quality": 0.7
 },
 {
  "id": "kr-sseodeolheun",
  "lang": "ko",
  "title": "사과가 쿵!",
  "author": "다다 히로시",
  "publisher": "보림",
  "titleRoman": "(KR ed.)",
  "ages": [
   "0-2",
   "3-4"
  ],
  "level": "보드북",
  "themes": [
   "동물",
   "음식",
   "일상"
  ],
  "mood": [
   "잔잔한",
   "따뜻한"
  ],
  "blurb": "커다란 사과 하나에 동물들이 차례로 모여 나눠 먹는 모습을 큼직한 그림과 짧은 글로 담아 아기에게 좋아요.",
  "readAloud": "\"쿵!\" 소리에 맞춰 책을 살짝 흔들어 주면 아기가 까르르 웃어요.",
  "cover": {
   "emoji": "🍎",
   "palette": [
    "#e0413e",
    "#8bc34a"
   ]
  },
  "source": "curated",
  "quality": 0.7
 },
 {
  "id": "kr-no-david",
  "lang": "ko",
  "title": "안 돼, 데이빗!",
  "author": "데이비드 섀논",
  "publisher": "지경사",
  "titleRoman": "No, David! (KR ed.)",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "가족",
   "감정",
   "일상",
   "유머"
  ],
  "mood": [
   "웃긴",
   "따뜻한"
  ],
  "blurb": "온갖 장난을 치는 데이빗에게 \"안 돼!\"를 외치다 결국 \"사랑해\"로 끝나는, 아이 마음을 꼭 안아 주는 책이에요.",
  "readAloud": "\"안 돼, 데이빗!\"을 아이와 번갈아 외치며 장난스럽게 읽어 보세요.",
  "cover": {
   "emoji": "🙅",
   "palette": [
    "#e8595e",
    "#f4d03f"
   ]
  },
  "source": "curated",
  "quality": 0.7
 },
 {
  "id": "kr-kkokkkok-sumeo",
  "lang": "ko",
  "title": "두드려 보아요",
  "author": "안나 클라라 티돌름",
  "publisher": "사계절",
  "titleRoman": "Knock! Knock! (KR ed.)",
  "ages": [
   "0-2",
   "3-4"
  ],
  "level": "보드북",
  "themes": [
   "일상",
   "환상",
   "동물"
  ],
  "mood": [
   "잔잔한",
   "따뜻한"
  ],
  "blurb": "문을 똑똑 두드리며 한 장씩 넘기는 반복 구조로 아기가 직접 책장을 넘기고 싶게 만들어요.",
  "readAloud": "책장을 넘기기 전에 \"똑똑\" 하고 책을 두드려 기대감을 주세요.",
  "cover": {
   "emoji": "🚪",
   "palette": [
    "#d98a2b",
    "#f0e3c2"
   ]
  },
  "source": "curated",
  "quality": 0.7
 },
 {
  "id": "kr-jeo-mari",
  "lang": "ko",
  "title": "지원이와 병관이",
  "author": "고대영",
  "publisher": "길벗어린이",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "일상",
   "가족",
   "친구",
   "감정"
  ],
  "mood": [
   "따뜻한",
   "웃긴"
  ],
  "blurb": "친근한 두 아이의 평범한 하루를 통해 또래 아이가 자기 일상을 책 속에서 만나는 인기 생활 그림책 시리즈예요.",
  "readAloud": "\"너도 이런 적 있어?\" 하고 아이의 비슷한 경험을 물어보세요.",
  "cover": {
   "emoji": "🧒",
   "palette": [
    "#7fb069",
    "#f6c453"
   ]
  },
  "source": "curated",
  "quality": 0.7
 },
 {
  "id": "kr-yuchiwon-ganeun-gil",
  "lang": "ko",
  "title": "치과 의사 드소토 선생님",
  "author": "윌리엄 스타이그",
  "publisher": "비룡소",
  "titleRoman": "Doctor De Soto (KR ed.)",
  "ages": [
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "동물",
   "유머",
   "일상",
   "감정"
  ],
  "mood": [
   "웃긴",
   "모험"
  ],
  "blurb": "생쥐 치과의사가 자기를 잡아먹으려는 여우를 꾀로 따돌리는 통쾌하고 영리한 이야기예요.",
  "readAloud": "여우의 음흉한 속셈과 드소토 부부의 작전을 목소리로 대비시켜 보세요.",
  "cover": {
   "emoji": "🦷",
   "palette": [
    "#d98a2b",
    "#cfe0ec"
   ]
  },
  "source": "curated",
  "quality": 0.7
 },
 {
  "id": "kr-nuneun-jakjiman",
  "lang": "ko",
  "title": "프레드릭",
  "author": "레오 리오니",
  "publisher": "시공주니어",
  "titleRoman": "Frederick (KR ed.)",
  "ages": [
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "동물",
   "감정",
   "자연",
   "친구"
  ],
  "mood": [
   "잔잔한",
   "따뜻한"
  ],
  "blurb": "겨울을 위해 햇살과 색깔과 이야기를 모은 들쥐 프레드릭이 예술의 가치를 잔잔하게 일깨워 줘요.",
  "readAloud": "프레드릭이 모은 햇살을 떠올리는 장면에서 잠시 눈을 감고 상상해 보세요.",
  "cover": {
   "emoji": "🐭",
   "palette": [
    "#9b8cb0",
    "#e8c07a"
   ]
  },
  "source": "curated",
  "quality": 0.7
 },
 {
  "id": "kr-saekkkal-bipa",
  "lang": "ko",
  "title": "무지개 물고기",
  "author": "마르쿠스 피스터",
  "publisher": "시공주니어",
  "titleRoman": "The Rainbow Fish (KR ed.)",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "동물",
   "친구",
   "감정",
   "자연"
  ],
  "mood": [
   "따뜻한",
   "학습"
  ],
  "blurb": "반짝이는 비늘을 친구들과 나누며 진짜 행복을 배우는 무지개 물고기 이야기로, 나눔의 기쁨을 알려 줘요.",
  "readAloud": "반짝이 비늘을 손끝으로 만지며 \"하나 나눠 줄까?\" 흉내 내 보세요.",
  "cover": {
   "emoji": "🐠",
   "palette": [
    "#3aa0d6",
    "#c0a0e0"
   ]
  },
  "source": "curated",
  "quality": 0.7
 },
 {
  "id": "kr-uju-danyeo",
  "lang": "ko",
  "title": "우주 다녀오겠습니다",
  "author": "장선환",
  "publisher": "딸기책방",
  "ages": [
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "우주",
   "환상",
   "모험",
   "자연"
  ],
  "mood": [
   "모험",
   "학습"
  ],
  "blurb": "우주로 떠나는 상상 여행을 한국 그림책 특유의 따뜻한 그림에 담아, 우주를 좋아하는 아이의 호기심을 한껏 채워 줘요.",
  "readAloud": "밤하늘 그림을 보며 \"저 별까지 가 볼까?\" 하고 함께 상상해 보세요.",
  "cover": {
   "emoji": "🪐",
   "palette": [
    "#1a2a55",
    "#f2d94e"
   ]
  },
  "source": "curated",
  "quality": 0.7
 },
 {
  "id": "kr-baekman-mari",
  "lang": "ko",
  "title": "백만 마리 고양이",
  "author": "완다 가그",
  "publisher": "시공주니어",
  "titleRoman": "Millions of Cats (KR ed.)",
  "ages": [
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "동물",
   "숫자/글자",
   "유머",
   "환상"
  ],
  "mood": [
   "웃긴",
   "잔잔한"
  ],
  "blurb": "백만 마리 고양이 중 단 한 마리를 고르는 할아버지 이야기로, 오래도록 사랑받아 온 그림책의 고전이에요.",
  "readAloud": "\"백 마리, 천 마리, 백만 마리!\" 후렴을 점점 크게 외쳐 보세요.",
  "cover": {
   "emoji": "🐈",
   "palette": [
    "#5b5b5b",
    "#e8e0c8"
   ]
  },
  "source": "curated",
  "quality": 0.7
 },
 {
  "id": "kr-juljuri-horangi",
  "lang": "ko",
  "title": "줄줄이 꿴 호랑이",
  "author": "권문희",
  "publisher": "사계절",
  "ages": [
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "동물",
   "유머",
   "환상",
   "모험"
  ],
  "mood": [
   "웃긴",
   "모험"
  ],
  "blurb": "꾀로 호랑이들을 줄줄이 엮어 버리는 우리 옛이야기로, 반복되는 리듬과 통쾌한 결말이 아이를 사로잡아요.",
  "readAloud": "호랑이가 한 마리씩 엮일 때마다 \"또 한 마리!\" 하고 손가락으로 세어 보세요.",
  "cover": {
   "emoji": "🐯",
   "palette": [
    "#b5651d",
    "#e8c07a"
   ]
  },
  "source": "curated",
  "quality": 0.7
 },
 {
  "id": "kr-naneun-gae",
  "lang": "ko",
  "title": "나는 개다",
  "author": "백희나",
  "publisher": "책읽는곰",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "동물",
   "가족",
   "일상",
   "감정"
  ],
  "mood": [
   "따뜻한",
   "웃긴"
  ],
  "blurb": "강아지 구슬이의 눈으로 바라본 집과 가족 이야기로, 백희나 특유의 입체 인형 그림이 반려견의 마음을 폭 감싸 줘요.",
  "readAloud": "구슬이가 가족을 바라보는 장면에서 \"강아지는 무슨 생각을 할까?\" 하고 물어보세요.",
  "cover": {
   "emoji": "🐶",
   "palette": [
    "#e6a23c",
    "#cfe3f0"
   ]
  },
  "source": "curated",
  "quality": 0.7
 },
 {
  "id": "kr-jageun-jip",
  "lang": "ko",
  "title": "괴물들이 사는 나라",
  "author": "모리스 샌닥",
  "publisher": "시공주니어",
  "titleRoman": "Where the Wild Things Are (KR ed.)",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "환상",
   "감정",
   "모험",
   "가족"
  ],
  "mood": [
   "모험",
   "따뜻한"
  ],
  "blurb": "화가 난 맥스가 괴물들의 나라로 떠났다 결국 따뜻한 저녁밥이 기다리는 집으로 돌아오는 마음의 모험이에요.",
  "readAloud": "\"괴물 소동을 시작하자!\" 장면에서 함께 발을 구르며 신나게 읽어 보세요.",
  "cover": {
   "emoji": "👹",
   "palette": [
    "#5a7d3c",
    "#e0c98a"
   ]
  },
  "source": "curated",
  "quality": 0.7
 },
 {
  "id": "kr-eojjeonji",
  "lang": "ko",
  "title": "치킨 마스크",
  "author": "우쓰기 미호",
  "publisher": "책읽는곰",
  "titleRoman": "(KR ed.)",
  "ages": [
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "감정",
   "친구",
   "일상",
   "유머"
  ],
  "mood": [
   "따뜻한",
   "잔잔한"
  ],
  "blurb": "남들과 달라 속상하던 아이가 자기만의 멋을 찾아가는 과정을 통해 \"나다움\"의 소중함을 알려 줘요.",
  "readAloud": "\"너는 어떤 게 제일 멋져?\" 하고 아이의 장점을 함께 찾아보세요.",
  "cover": {
   "emoji": "🐔",
   "palette": [
    "#f4c430",
    "#e8595e"
   ]
  },
  "source": "curated",
  "quality": 0.7
 },
 {
  "id": "kr-batjul",
  "lang": "ko",
  "title": "달님 안녕",
  "author": "하야시 아키코",
  "publisher": "한림출판사",
  "titleRoman": "Good Night, Moon (Hayashi, KR ed.)",
  "ages": [
   "0-2",
   "3-4"
  ],
  "level": "보드북",
  "themes": [
   "잠자리",
   "자연",
   "일상",
   "가족"
  ],
  "mood": [
   "잔잔한",
   "따뜻한"
  ],
  "blurb": "구름에 가렸다 다시 나타나는 달님에게 인사하는 단순하고 포근한 잠자리 그림책의 대표작이에요.",
  "readAloud": "\"달님, 안녕\" 하고 창밖 달을 가리키며 마무리하면 잠들기 좋아요.",
  "cover": {
   "emoji": "🌝",
   "palette": [
    "#2b3a67",
    "#f4d35e"
   ]
  },
  "source": "curated",
  "quality": 0.7
 },
 {
  "id": "kr-soksak",
  "lang": "ko",
  "title": "싹싹싹",
  "author": "하야시 아키코",
  "publisher": "한림출판사",
  "titleRoman": "(KR ed.)",
  "ages": [
   "0-2",
   "3-4"
  ],
  "level": "보드북",
  "themes": [
   "일상",
   "음식",
   "동물"
  ],
  "mood": [
   "잔잔한",
   "따뜻한"
  ],
  "blurb": "밥을 깨끗이 비우는 모습을 정겨운 그림으로 보여 주어 아기의 식사 습관에 좋은 첫 보드북이에요.",
  "readAloud": "\"싹싹싹\" 소리에 맞춰 숟가락 흉내를 내며 읽어 보세요.",
  "cover": {
   "emoji": "🍚",
   "palette": [
    "#f0e3c2",
    "#e8a04b"
   ]
  },
  "source": "curated",
  "quality": 0.7
 },
 {
  "id": "kr-momi-ggomjirak",
  "lang": "ko",
  "title": "악어도 깜짝, 치과 의사도 깜짝!",
  "author": "고미 타로",
  "publisher": "비룡소",
  "titleRoman": "(KR ed.)",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "동물",
   "유머",
   "일상"
  ],
  "mood": [
   "웃긴",
   "학습"
  ],
  "blurb": "악어와 치과의사가 똑같은 대사를 주고받는 거울 구성으로, 양치와 치과의 두려움을 웃음으로 풀어 줘요.",
  "readAloud": "양쪽 페이지를 번갈아 읽으며 같은 말이 반복되는 재미를 느껴 보세요.",
  "cover": {
   "emoji": "🐊",
   "palette": [
    "#5a8f3c",
    "#f4d35e"
   ]
  },
  "source": "curated",
  "quality": 0.7
 },
 {
  "id": "kr-amuto-mollae",
  "lang": "ko",
  "title": "사라, 버스를 타다",
  "author": "윌리엄 밀러",
  "publisher": "사계절",
  "titleRoman": "(KR ed.)",
  "ages": [
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "감정",
   "가족",
   "일상"
  ],
  "mood": [
   "잔잔한",
   "학습"
  ],
  "blurb": "버스 앞자리에 앉고 싶었던 사라의 작은 용기를 통해 평등과 정의의 가치를 아이 눈높이로 전해요.",
  "readAloud": "\"왜 사라는 뒤에 앉아야 했을까?\" 하고 함께 생각해 보세요.",
  "cover": {
   "emoji": "🚌",
   "palette": [
    "#c98a3b",
    "#5b5b5b"
   ]
  },
  "source": "curated",
  "quality": 0.7
 },
 {
  "id": "kr-osori-kkotbat",
  "lang": "ko",
  "title": "오소리네 집 꽃밭",
  "author": "권정생",
  "publisher": "길벗어린이",
  "ages": [
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "동물",
   "자연",
   "감정",
   "일상"
  ],
  "mood": [
   "잔잔한",
   "따뜻한"
  ],
  "blurb": "들꽃 가득한 오소리네 마당을 권정생 특유의 따뜻한 시선으로 그려, 우리 산과 들의 정겨운 아름다움을 일깨워 줘요.",
  "readAloud": "그림 속 들꽃 이름을 하나씩 짚으며 \"이 꽃 본 적 있어?\" 하고 물어보세요.",
  "cover": {
   "emoji": "🦡",
   "palette": [
    "#8a6d3b",
    "#d9c5a0"
   ]
  },
  "source": "curated",
  "quality": 0.7
 },
 {
  "id": "en-hungry-caterpillar",
  "lang": "en",
  "title": "The Very Hungry Caterpillar",
  "author": "Eric Carle",
  "publisher": "Philomel Books",
  "ages": [
   "0-2",
   "3-4"
  ],
  "level": "보드북",
  "themes": [
   "동물",
   "음식",
   "자연",
   "숫자/글자"
  ],
  "mood": [
   "학습",
   "따뜻한"
  ],
  "blurb": "애벌레가 요일마다 과일을 먹어 치우며 나비가 되는 이야기로, 요일·숫자·색을 자연스럽게 익혀요.",
  "readAloud": "구멍 난 과일 페이지에 손가락을 넣어 \"쏙\" 하고 통과시켜 보세요.",
  "cover": {
   "emoji": "🐛",
   "palette": [
    "#5cb85c",
    "#e8595e"
   ]
  },
  "isbn": "9780399226908",
  "source": "curated",
  "quality": 0.7
 },
 {
  "id": "en-brown-bear",
  "lang": "en",
  "title": "Brown Bear, Brown Bear, What Do You See?",
  "author": "Bill Martin Jr. & Eric Carle",
  "publisher": "Henry Holt",
  "ages": [
   "0-2",
   "3-4"
  ],
  "level": "보드북",
  "themes": [
   "동물",
   "숫자/글자",
   "자연"
  ],
  "mood": [
   "학습",
   "잔잔한"
  ],
  "blurb": "반복되는 문장과 선명한 색의 동물들이 이어져 아기의 첫 영어 패턴 읽기에 더없이 좋아요.",
  "readAloud": "\"What do you see?\"를 부모가 묻고 아이가 다음 동물을 맞히게 해 보세요.",
  "cover": {
   "emoji": "🐻",
   "palette": [
    "#8a5a2b",
    "#e8c07a"
   ]
  },
  "isbn": "9780805047905",
  "source": "curated",
  "quality": 0.7
 },
 {
  "id": "en-goodnight-moon",
  "lang": "en",
  "title": "Goodnight Moon",
  "author": "Margaret Wise Brown",
  "publisher": "HarperCollins",
  "ages": [
   "0-2",
   "3-4"
  ],
  "level": "보드북",
  "themes": [
   "잠자리",
   "일상",
   "자연"
  ],
  "mood": [
   "잔잔한",
   "따뜻한"
  ],
  "blurb": "방 안 물건 하나하나에 잘 자라 인사하는 잔잔한 운율이 아기를 스르르 잠들게 하는 잠자리 고전이에요.",
  "readAloud": "목소리를 점점 작게 낮춰 마지막엔 속삭이듯 \"goodnight\"으로 마무리해요.",
  "cover": {
   "emoji": "🌙",
   "palette": [
    "#2b6b4f",
    "#f4d35e"
   ]
  },
  "isbn": "9780060275044",
  "source": "curated",
  "quality": 0.7
 },
 {
  "id": "en-gruffalo",
  "lang": "en",
  "title": "The Gruffalo",
  "author": "Julia Donaldson & Axel Scheffler",
  "publisher": "Macmillan",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "동물",
   "환상",
   "모험",
   "유머"
  ],
  "mood": [
   "모험",
   "웃긴"
  ],
  "blurb": "꾀 많은 생쥐가 무서운 괴물 그루팔로를 상상으로 만들어 위기를 넘기는, 운율이 살아 있는 모험담이에요.",
  "readAloud": "라임이 많으니 끝 단어를 아이가 따라 말하도록 잠깐 멈춰 주세요.",
  "cover": {
   "emoji": "👹",
   "palette": [
    "#7a5230",
    "#a8c66c"
   ]
  },
  "isbn": "9780333710937",
  "source": "curated",
  "quality": 0.7
 },
 {
  "id": "en-room-on-broom",
  "lang": "en",
  "title": "Room on the Broom",
  "author": "Julia Donaldson & Axel Scheffler",
  "publisher": "Macmillan",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "환상",
   "동물",
   "모험",
   "친구"
  ],
  "mood": [
   "모험",
   "웃긴"
  ],
  "blurb": "마녀의 빗자루에 동물 친구들이 하나둘 올라타며 협동의 힘을 보여 주는 신나는 운율 그림책이에요.",
  "readAloud": "빗자루가 점점 무거워지는 만큼 목소리에 힘을 실어 읽어 보세요.",
  "cover": {
   "emoji": "🧹",
   "palette": [
    "#5b3b8a",
    "#e8a04b"
   ]
  },
  "isbn": "9780333903384",
  "source": "curated",
  "quality": 0.7
 },
 {
  "id": "en-stick-man",
  "lang": "en",
  "title": "Stick Man",
  "author": "Julia Donaldson & Axel Scheffler",
  "publisher": "Alison Green Books",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "환상",
   "가족",
   "모험",
   "자연"
  ],
  "mood": [
   "모험",
   "따뜻한"
  ],
  "blurb": "집으로 돌아가려는 막대기 아빠의 모험을 통해 가족의 소중함을 운율 가득한 이야기로 전해요.",
  "readAloud": "막대 인간이 이리저리 휩쓸리는 장면에서 책을 함께 흔들어 보세요.",
  "cover": {
   "emoji": "🪵",
   "palette": [
    "#8a5a2b",
    "#a8c66c"
   ]
  },
  "isbn": "9781407124100",
  "source": "curated",
  "quality": 0.7
 },
 {
  "id": "en-snail-whale",
  "lang": "en",
  "title": "The Snail and the Whale",
  "author": "Julia Donaldson & Axel Scheffler",
  "publisher": "Macmillan",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "동물",
   "자연",
   "모험",
   "친구"
  ],
  "mood": [
   "모험",
   "잔잔한"
  ],
  "blurb": "작은 달팽이가 거대한 고래 등에 올라 온 세상을 누비는 여행으로, 작아도 큰일을 해낼 수 있음을 보여 줘요.",
  "readAloud": "바다와 빙산, 화산 장면마다 손으로 풍경을 크게 그려 보여 주세요.",
  "cover": {
   "emoji": "🐌",
   "palette": [
    "#3a7ca5",
    "#d9c5a0"
   ]
  },
  "isbn": "9780333982235",
  "source": "curated",
  "quality": 0.7
 },
 {
  "id": "en-wild-things",
  "lang": "en",
  "title": "Where the Wild Things Are",
  "author": "Maurice Sendak",
  "publisher": "Harper & Row",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "환상",
   "감정",
   "모험",
   "가족"
  ],
  "mood": [
   "모험",
   "따뜻한"
  ],
  "blurb": "화가 난 맥스가 괴물 나라의 왕이 되었다 따뜻한 집으로 돌아오는, 아이의 감정을 끌어안는 명작이에요.",
  "readAloud": "\"Let the wild rumpus start!\" 장면에서 함께 쿵쿵 발을 굴러요.",
  "cover": {
   "emoji": "🐉",
   "palette": [
    "#5a7d3c",
    "#e0c98a"
   ]
  },
  "isbn": "9780060254926",
  "source": "curated",
  "quality": 0.7
 },
 {
  "id": "en-bear-hunt",
  "lang": "en",
  "title": "We're Going on a Bear Hunt",
  "author": "Michael Rosen & Helen Oxenbury",
  "publisher": "Walker Books",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "모험",
   "가족",
   "자연",
   "동물"
  ],
  "mood": [
   "모험",
   "웃긴"
  ],
  "blurb": "풀밭과 강, 진흙을 헤치며 곰을 찾아 떠나는 가족의 여정이 온몸으로 따라 하기 좋은 리듬으로 펼쳐져요.",
  "readAloud": "\"Swishy swashy!\" 같은 의성어를 손동작과 함께 크게 따라 해 보세요.",
  "cover": {
   "emoji": "🐻",
   "palette": [
    "#3a7ca5",
    "#a8c66c"
   ]
  },
  "isbn": "9780744523232",
  "source": "curated",
  "quality": 0.7
 },
 {
  "id": "en-dear-zoo",
  "lang": "en",
  "title": "Dear Zoo",
  "author": "Rod Campbell",
  "publisher": "Macmillan",
  "ages": [
   "0-2",
   "3-4"
  ],
  "level": "보드북",
  "themes": [
   "동물",
   "유머",
   "일상"
  ],
  "mood": [
   "학습",
   "웃긴"
  ],
  "blurb": "동물원에 애완동물을 보내 달라 편지를 보내자 도착하는 동물들을 플랩 아래 숨겨 둔 인기 보드북이에요.",
  "readAloud": "플랩을 열기 전에 \"무슨 동물일까?\" 하고 아이가 맞히게 해 보세요.",
  "cover": {
   "emoji": "🦒",
   "palette": [
    "#e8a04b",
    "#5cb85c"
   ]
  },
  "isbn": "9780333950135",
  "source": "curated",
  "quality": 0.7
 },
 {
  "id": "en-tiger-tea",
  "lang": "en",
  "title": "The Tiger Who Came to Tea",
  "author": "Judith Kerr",
  "publisher": "HarperCollins",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "동물",
   "음식",
   "가족",
   "환상"
  ],
  "mood": [
   "웃긴",
   "따뜻한"
  ],
  "blurb": "느닷없이 찾아와 집 안 음식을 모두 먹어 치우는 호랑이의 황당하고 다정한 방문기를 그렸어요.",
  "readAloud": "호랑이가 음식을 먹을 때마다 \"또 먹어?\" 하고 놀라는 연기를 해 보세요.",
  "cover": {
   "emoji": "🐅",
   "palette": [
    "#e8893c",
    "#f4d35e"
   ]
  },
  "isbn": "9780007215997",
  "source": "curated",
  "quality": 0.7
 },
 {
  "id": "en-guess-love",
  "lang": "en",
  "title": "Guess How Much I Love You",
  "author": "Sam McBratney & Anita Jeram",
  "publisher": "Walker Books",
  "ages": [
   "0-2",
   "3-4"
  ],
  "level": "그림책",
  "themes": [
   "가족",
   "감정",
   "동물",
   "자연"
  ],
  "mood": [
   "따뜻한",
   "잔잔한"
  ],
  "blurb": "아기 토끼와 큰 토끼가 사랑의 크기를 겨루는 다정한 잠자리 이야기로, 마음을 표현하는 말을 배워요.",
  "readAloud": "팔을 활짝 벌리며 \"이만큼 사랑해\"를 아이와 함께 흉내 내 보세요.",
  "cover": {
   "emoji": "🐰",
   "palette": [
    "#7fb069",
    "#e8c07a"
   ]
  },
  "isbn": "9780763642648",
  "source": "curated",
  "quality": 0.7
 },
 {
  "id": "en-press-here",
  "lang": "en",
  "title": "Press Here",
  "author": "Hervé Tullet",
  "publisher": "Chronicle Books",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "그림그리기",
   "숫자/글자",
   "유머",
   "환상"
  ],
  "mood": [
   "웃긴",
   "학습"
  ],
  "blurb": "점을 누르고 흔들고 부는 대로 다음 장에서 변하는 마법 같은 상호작용으로 아이가 책과 직접 놀아요.",
  "readAloud": "지시대로 점을 누르고 책을 흔든 뒤 \"우와, 진짜 변했네!\" 하고 함께 놀라요.",
  "cover": {
   "emoji": "🔴",
   "palette": [
    "#e8595e",
    "#f4d35e"
   ]
  },
  "isbn": "9780811879545",
  "source": "curated",
  "quality": 0.7
 },
 {
  "id": "en-pigeon-bus",
  "lang": "en",
  "title": "Don't Let the Pigeon Drive the Bus!",
  "author": "Mo Willems",
  "publisher": "Hyperion Books",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "유머",
   "감정",
   "탈것",
   "일상"
  ],
  "mood": [
   "웃긴"
  ],
  "blurb": "버스를 몰고 싶어 온갖 떼를 쓰는 비둘기에게 아이가 \"안 돼!\"라고 답하며 깔깔 웃게 되는 책이에요.",
  "readAloud": "비둘기가 조를 때마다 아이가 \"No!\"라고 크게 외치게 해 보세요.",
  "cover": {
   "emoji": "🐦",
   "palette": [
    "#3aa0d6",
    "#f4d35e"
   ]
  },
  "isbn": "9780786819881",
  "source": "curated",
  "quality": 0.7
 },
 {
  "id": "en-each-peach",
  "lang": "en",
  "title": "Each Peach Pear Plum",
  "author": "Janet & Allan Ahlberg",
  "publisher": "Viking Kestrel",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "환상",
   "숫자/글자",
   "유머",
   "자연"
  ],
  "mood": [
   "잔잔한",
   "학습"
  ],
  "blurb": "그림 속에 숨은 동화 속 인물을 찾아내는 \"I spy\" 운율 책으로, 관찰력과 영어 라임을 동시에 길러요.",
  "readAloud": "\"I spy…\" 다음에 멈춰 아이가 그림 속 인물을 직접 찾게 해 보세요.",
  "cover": {
   "emoji": "🍑",
   "palette": [
    "#e8893c",
    "#a8c66c"
   ]
  },
  "isbn": "9780670286973",
  "source": "curated",
  "quality": 0.7
 },
 {
  "id": "en-very-busy-spider",
  "lang": "en",
  "title": "The Very Busy Spider",
  "author": "Eric Carle",
  "publisher": "Philomel Books",
  "ages": [
   "0-2",
   "3-4"
  ],
  "level": "보드북",
  "themes": [
   "동물",
   "자연",
   "일상"
  ],
  "mood": [
   "잔잔한",
   "학습"
  ],
  "blurb": "거미가 묵묵히 거미줄을 완성하는 동안 동물들이 말을 거는 반복 구조로, 집중과 끈기를 보여 줘요.",
  "readAloud": "거미줄을 손끝으로 따라 그리며 \"점점 커지네\" 하고 짚어 주세요.",
  "cover": {
   "emoji": "🕷️",
   "palette": [
    "#5b5b5b",
    "#f4d35e"
   ]
  },
  "isbn": "9780399229190",
  "source": "curated",
  "quality": 0.7
 },
 {
  "id": "en-elmer",
  "lang": "en",
  "title": "Elmer",
  "author": "David McKee",
  "publisher": "Andersen Press",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "동물",
   "감정",
   "유머",
   "친구"
  ],
  "mood": [
   "따뜻한",
   "웃긴"
  ],
  "blurb": "알록달록 무늬의 코끼리 엘머가 남과 다른 자신을 받아들이는 이야기로, 다름의 아름다움을 알려 줘요.",
  "readAloud": "엘머의 색색 무늬를 손가락으로 짚으며 색 이름을 영어로 함께 말해 보세요.",
  "cover": {
   "emoji": "🐘",
   "palette": [
    "#e8595e",
    "#5cb85c"
   ]
  },
  "isbn": "9781783446667",
  "source": "curated",
  "quality": 0.7
 },
 {
  "id": "en-handa-surprise",
  "lang": "en",
  "title": "Handa's Surprise",
  "author": "Eileen Browne",
  "publisher": "Walker Books",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "동물",
   "음식",
   "자연",
   "유머"
  ],
  "mood": [
   "웃긴",
   "학습"
  ],
  "blurb": "친구에게 과일을 가져가는 동안 동물들이 하나씩 가져가는 줄도 모르는 한다의 이야기가 깜짝 반전을 줘요.",
  "readAloud": "한다 뒤에서 동물이 과일을 가져갈 때 아이만 보이는 비밀을 함께 속닥여요.",
  "cover": {
   "emoji": "🍌",
   "palette": [
    "#e8a04b",
    "#5cb85c"
   ]
  },
  "isbn": "9780744536348",
  "source": "curated",
  "quality": 0.7
 },
 {
  "id": "en-very-lonely-firefly",
  "lang": "en",
  "title": "The Very Lonely Firefly",
  "author": "Eric Carle",
  "publisher": "Philomel Books",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "동물",
   "자연",
   "감정",
   "친구"
  ],
  "mood": [
   "잔잔한",
   "따뜻한"
  ],
  "blurb": "친구를 찾아 밤하늘을 헤매는 반딧불이 이야기로, 마지막에 반짝이는 페이지가 감탄을 자아내요.",
  "readAloud": "어두운 방에서 마지막 반짝이는 장면을 펼치면 효과가 배가돼요.",
  "cover": {
   "emoji": "✨",
   "palette": [
    "#2b3a67",
    "#f4d35e"
   ]
  },
  "isbn": "9780399504693",
  "source": "curated",
  "quality": 0.7
 },
 {
  "id": "en-mr-gumpy",
  "lang": "en",
  "title": "Mr Gumpy's Outing",
  "author": "John Burningham",
  "publisher": "Jonathan Cape",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "동물",
   "탈것",
   "자연",
   "유머"
  ],
  "mood": [
   "잔잔한",
   "웃긴"
  ],
  "blurb": "검피 아저씨의 작은 배에 동물들이 차례로 올라타다 결국 뒤집히는 유쾌한 강 나들이 이야기예요.",
  "readAloud": "배에 동물이 탈 때마다 약속을 거는 부분을 아이와 번갈아 읽어 보세요.",
  "cover": {
   "emoji": "⛵",
   "palette": [
    "#3a7ca5",
    "#e8c07a"
   ]
  },
  "isbn": "9780099408796",
  "source": "curated",
  "quality": 0.7
 },
 {
  "id": "en-rainbow-fish",
  "lang": "en",
  "title": "The Rainbow Fish",
  "author": "Marcus Pfister",
  "publisher": "NorthSouth Books",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "동물",
   "친구",
   "감정",
   "자연"
  ],
  "mood": [
   "따뜻한",
   "학습"
  ],
  "blurb": "반짝 비늘을 나눠 주며 진짜 행복을 찾는 무지개 물고기로, 나눔의 가치를 반짝이는 그림으로 전해요.",
  "readAloud": "반짝이는 비늘 페이지를 빛에 비춰 보며 \"예쁘다\" 함께 감탄해 보세요.",
  "cover": {
   "emoji": "🐠",
   "palette": [
    "#3aa0d6",
    "#c0a0e0"
   ]
  },
  "isbn": "9781558580091",
  "source": "curated",
  "quality": 0.7
 },
 {
  "id": "en-gruffalos-child",
  "lang": "en",
  "title": "The Gruffalo's Child",
  "author": "Julia Donaldson & Axel Scheffler",
  "publisher": "Macmillan",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "동물",
   "환상",
   "모험",
   "가족"
  ],
  "mood": [
   "모험",
   "웃긴"
  ],
  "blurb": "겁 없는 그루팔로의 아이가 무서운 생쥐를 찾아 눈 덮인 숲을 헤매는 속편으로, 운율의 재미가 이어져요.",
  "readAloud": "눈밭을 헤치는 장면에서 발소리 \"crunch crunch\"를 함께 내 보세요.",
  "cover": {
   "emoji": "🌲",
   "palette": [
    "#3b5a3b",
    "#e0c98a"
   ]
  },
  "isbn": "9781405020459",
  "source": "curated",
  "quality": 0.7
 },
 {
  "id": "en-tooth-fairy",
  "lang": "en",
  "title": "Owl Babies",
  "author": "Martin Waddell & Patrick Benson",
  "publisher": "Walker Books",
  "ages": [
   "0-2",
   "3-4"
  ],
  "level": "그림책",
  "themes": [
   "동물",
   "가족",
   "감정",
   "자연"
  ],
  "mood": [
   "따뜻한",
   "잔잔한"
  ],
  "blurb": "엄마를 기다리는 아기 올빼미 삼 남매의 불안과 안도를 통해 분리불안을 다정하게 어루만져요.",
  "readAloud": "막내 빌이 \"I want my mummy!\"를 외칠 때 살짝 떨리는 목소리로 읽어 보세요.",
  "cover": {
   "emoji": "🦉",
   "palette": [
    "#3b3b3b",
    "#e8c07a"
   ]
  },
  "isbn": "9780744531671",
  "source": "curated",
  "quality": 0.7
 },
 {
  "id": "en-tiddler",
  "lang": "en",
  "title": "Tiddler",
  "author": "Julia Donaldson & Axel Scheffler",
  "publisher": "Alison Green Books",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "동물",
   "유머",
   "자연",
   "모험"
  ],
  "mood": [
   "웃긴",
   "모험"
  ],
  "blurb": "허풍쟁이 작은 물고기 티들러의 이야기 솜씨가 진짜 위기에서 친구들을 구하는 바닷속 모험담이에요.",
  "readAloud": "티들러의 과장된 변명을 점점 더 능청스러운 목소리로 읽어 보세요.",
  "cover": {
   "emoji": "🐟",
   "palette": [
    "#3a7ca5",
    "#f4d35e"
   ]
  },
  "isbn": "9781407109480",
  "source": "curated",
  "quality": 0.7
 },
 {
  "id": "en-knuffle-bunny",
  "lang": "en",
  "title": "Knuffle Bunny",
  "author": "Mo Willems",
  "publisher": "Hyperion Books",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "가족",
   "감정",
   "일상",
   "유머"
  ],
  "mood": [
   "웃긴",
   "따뜻한"
  ],
  "blurb": "빨래방에 토끼 인형을 두고 온 트릭시가 말로 못 하는 답답함을 온몸으로 표현하는 사랑스러운 이야기예요.",
  "readAloud": "트릭시가 떼쓰는 \"Aggle flaggle klabble!\"을 신나게 흉내 내 보세요.",
  "cover": {
   "emoji": "🐰",
   "palette": [
    "#6b8e9e",
    "#e8c07a"
   ]
  },
  "isbn": "9780786818709",
  "source": "curated",
  "quality": 0.7
 },
 {
  "id": "en-lost-found",
  "lang": "en",
  "title": "Lost and Found",
  "author": "Oliver Jeffers",
  "publisher": "HarperCollins",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "동물",
   "친구",
   "감정",
   "모험"
  ],
  "mood": [
   "따뜻한",
   "모험"
  ],
  "blurb": "길 잃은 펭귄을 남극까지 데려다주려는 소년의 여정을 통해 진짜 외로움과 우정의 의미를 잔잔히 그려요.",
  "readAloud": "노 젓는 장면에서 \"slosh slosh\" 파도 소리를 함께 내 보세요.",
  "cover": {
   "emoji": "🐧",
   "palette": [
    "#3a7ca5",
    "#f0e3c2"
   ]
  },
  "isbn": "9780007150366",
  "source": "curated",
  "quality": 0.7
 },
 {
  "id": "en-how-catch-star",
  "lang": "en",
  "title": "How to Catch a Star",
  "author": "Oliver Jeffers",
  "publisher": "HarperCollins",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "우주",
   "자연",
   "감정",
   "환상"
  ],
  "mood": [
   "잔잔한",
   "따뜻한"
  ],
  "blurb": "별을 갖고 싶은 아이가 온갖 방법을 궁리하는 이야기로, 꿈과 끈기를 따뜻한 그림으로 담았어요.",
  "readAloud": "밤하늘을 올려다보는 마음으로 천천히 읽어 잔잔함을 살려 주세요.",
  "cover": {
   "emoji": "⭐",
   "palette": [
    "#2b3a67",
    "#f4d35e"
   ]
  },
  "isbn": "9780007150342",
  "source": "curated",
  "quality": 0.7
 },
 {
  "id": "en-incredible-book-eating",
  "lang": "en",
  "title": "The Incredible Book Eating Boy",
  "author": "Oliver Jeffers",
  "publisher": "HarperCollins",
  "ages": [
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "유머",
   "숫자/글자",
   "환상",
   "일상"
  ],
  "mood": [
   "웃긴",
   "학습"
  ],
  "blurb": "책을 먹어 똑똑해지려던 소년이 결국 책 읽는 즐거움을 발견하는, 책 사랑을 일깨우는 유쾌한 이야기예요.",
  "readAloud": "\"책을 먹으면 어떨까?\" 하고 엉뚱한 상상을 아이와 함께 펼쳐 보세요.",
  "cover": {
   "emoji": "📚",
   "palette": [
    "#b5651d",
    "#e8c07a"
   ]
  },
  "isbn": "9780007182329",
  "source": "curated",
  "quality": 0.7
 },
 {
  "id": "en-pout-pout-fish",
  "lang": "en",
  "title": "The Pout-Pout Fish",
  "author": "Deborah Diesen & Dan Hanna",
  "publisher": "Farrar Straus Giroux",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "동물",
   "감정",
   "자연",
   "유머"
  ],
  "mood": [
   "따뜻한",
   "웃긴"
  ],
  "blurb": "늘 시무룩한 물고기가 웃음을 되찾는 이야기로, 운율을 따라 읽으며 감정을 표현하는 법을 배워요.",
  "readAloud": "\"blub blub blub\" 후렴을 아이와 입을 쭉 내밀고 함께 외쳐 보세요.",
  "cover": {
   "emoji": "🐡",
   "palette": [
    "#3a7ca5",
    "#e8a04b"
   ]
  },
  "isbn": "9780374360979",
  "source": "curated",
  "quality": 0.7
 },
 {
  "id": "en-dont-feed-the-bear",
  "lang": "en",
  "title": "We Don't Eat Our Classmates",
  "author": "Ryan T. Higgins",
  "publisher": "Disney-Hyperion",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "공룡",
   "친구",
   "감정",
   "유머"
  ],
  "mood": [
   "웃긴",
   "따뜻한"
  ],
  "blurb": "반 친구를 먹고 싶은 공룡 페넬로페가 우정을 배우는 이야기로, 학교 적응과 공감을 웃음으로 풀어 줘요.",
  "readAloud": "페넬로페가 친구를 덥석 무는 장면에서 \"안 돼!\" 하고 같이 말려 보세요.",
  "cover": {
   "emoji": "🦕",
   "palette": [
    "#5cb85c",
    "#e8595e"
   ]
  },
  "isbn": "9781368003551",
  "source": "curated",
  "quality": 0.7
 },
 {
  "id": "en-not-a-box",
  "lang": "en",
  "title": "Not a Box",
  "author": "Antoinette Portis",
  "publisher": "HarperCollins",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "환상",
   "그림그리기",
   "유머",
   "일상"
  ],
  "mood": [
   "웃긴",
   "학습"
  ],
  "blurb": "그냥 상자가 아니라 자동차도 로켓도 되는 토끼의 상상력을 통해 아이의 창의력을 톡톡 건드려요.",
  "readAloud": "\"이 상자는 뭐가 될 수 있을까?\" 하고 집 안 상자로 직접 놀아 보세요.",
  "cover": {
   "emoji": "📦",
   "palette": [
    "#c98a3b",
    "#e8595e"
   ]
  },
  "isbn": "9780061123221",
  "source": "curated",
  "quality": 0.7
 },
 {
  "id": "en-giraffes-cant-dance",
  "lang": "en",
  "title": "Giraffes Can't Dance",
  "author": "Giles Andreae & Guy Parker-Rees",
  "publisher": "Orchard Books",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "동물",
   "감정",
   "친구",
   "유머"
  ],
  "mood": [
   "따뜻한",
   "웃긴"
  ],
  "blurb": "춤 못 추는 기린 제럴드가 자기만의 음악을 찾아 멋지게 춤추는 이야기로, 자신감을 북돋아 줘요.",
  "readAloud": "마지막 제럴드가 춤추는 장면에서 아이와 함께 일어나 춤춰 보세요.",
  "cover": {
   "emoji": "🦒",
   "palette": [
    "#e8a04b",
    "#7fb069"
   ]
  },
  "isbn": "9781841215655",
  "source": "curated",
  "quality": 0.7
 },
 {
  "id": "en-tree-house",
  "lang": "en",
  "title": "The Day the Crayons Quit",
  "author": "Drew Daywalt & Oliver Jeffers",
  "publisher": "Philomel Books",
  "ages": [
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "그림그리기",
   "감정",
   "유머",
   "숫자/글자"
  ],
  "mood": [
   "웃긴",
   "따뜻한"
  ],
  "blurb": "파업을 선언한 크레용들의 편지로 이야기가 펼쳐져, 색과 감정 표현을 유쾌하게 배우게 해요.",
  "readAloud": "크레용마다 다른 성격이 드러나도록 색깔별로 목소리를 바꿔 읽어 보세요.",
  "cover": {
   "emoji": "🖍️",
   "palette": [
    "#e8595e",
    "#3aa0d6"
   ]
  },
  "isbn": "9780399255373",
  "source": "curated",
  "quality": 0.7
 },
 {
  "id": "en-tiny-seed",
  "lang": "en",
  "title": "The Tiny Seed",
  "author": "Eric Carle",
  "publisher": "Simon & Schuster",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "자연",
   "감정",
   "숫자/글자"
  ],
  "mood": [
   "잔잔한",
   "학습"
  ],
  "blurb": "작은 씨앗 하나가 사계절을 거쳐 큰 꽃으로 자라는 과정을 통해 생명의 순환을 아름답게 보여 줘요.",
  "readAloud": "씨앗이 바람에 날리는 장면에서 후 불며 함께 날려 보세요.",
  "cover": {
   "emoji": "🌱",
   "palette": [
    "#6aa84f",
    "#e8c07a"
   ]
  },
  "isbn": "9780689842443",
  "source": "curated",
  "quality": 0.7
 },
 {
  "id": "en-monkey-puzzle",
  "lang": "en",
  "title": "Monkey Puzzle",
  "author": "Julia Donaldson & Axel Scheffler",
  "publisher": "Macmillan",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "동물",
   "가족",
   "모험",
   "유머"
  ],
  "mood": [
   "모험",
   "따뜻한"
  ],
  "blurb": "엄마를 잃어버린 아기 원숭이가 나비와 함께 엄마를 찾아 나서는 운율 가득한 정글 모험이에요.",
  "readAloud": "나비가 엉뚱한 동물을 데려올 때마다 \"이게 엄마야?\" 하고 함께 웃어요.",
  "cover": {
   "emoji": "🐒",
   "palette": [
    "#5a8f3c",
    "#e8a04b"
   ]
  },
  "isbn": "9780333720011",
  "source": "curated",
  "quality": 0.7
 },
 {
  "id": "en-zog",
  "lang": "en",
  "title": "Zog",
  "author": "Julia Donaldson & Axel Scheffler",
  "publisher": "Alison Green Books",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "환상",
   "모험",
   "친구",
   "유머"
  ],
  "mood": [
   "모험",
   "웃긴"
  ],
  "blurb": "용 학교에서 늘 실수투성이인 조그가 친절한 공주를 만나 자기 길을 찾는 운율 가득한 모험담이에요.",
  "readAloud": "조그가 다치는 장면마다 \"아야!\" 하고 함께 안타까워해 주세요.",
  "cover": {
   "emoji": "🐲",
   "palette": [
    "#5cb85c",
    "#e8a04b"
   ]
  },
  "isbn": "9781407115573",
  "source": "curated",
  "quality": 0.7
 },
 {
  "id": "en-naughty-bus",
  "lang": "en",
  "title": "Naughty Bus",
  "author": "Jan Oke & Jerry Oke",
  "publisher": "Little Knowall",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "탈것",
   "자동차",
   "유머",
   "모험"
  ],
  "mood": [
   "웃긴",
   "모험"
  ],
  "blurb": "장난감 빨간 버스가 집 안 곳곳을 누비며 사고를 치는 이야기로, 탈것 좋아하는 아이가 푹 빠져요.",
  "readAloud": "버스가 \"붕\" 달리고 \"첨벙\" 빠지는 효과음을 신나게 넣어 읽어 보세요.",
  "cover": {
   "emoji": "🚌",
   "palette": [
    "#e8595e",
    "#f4d35e"
   ]
  },
  "isbn": "9780954792114",
  "source": "curated",
  "quality": 0.7
 },
 {
  "id": "en-dinosaurs-love",
  "lang": "en",
  "title": "Dinosaurs Love Underpants",
  "author": "Claire Freedman & Ben Cort",
  "publisher": "Simon & Schuster",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "공룡",
   "유머",
   "환상"
  ],
  "mood": [
   "웃긴",
   "모험"
  ],
  "blurb": "공룡이 멸종한 진짜 이유가 팬티 쟁탈전이라는 엉뚱한 상상으로 아이들을 자지러지게 웃겨요.",
  "readAloud": "\"underpants!\"가 나올 때마다 아이가 큰 소리로 외치게 해 보세요.",
  "cover": {
   "emoji": "🦖",
   "palette": [
    "#5cb85c",
    "#3aa0d6"
   ]
  },
  "isbn": "9781416988502",
  "source": "curated",
  "quality": 0.7
 },
 {
  "id": "en-hairy-maclary",
  "lang": "en",
  "title": "Hairy Maclary from Donaldson's Dairy",
  "author": "Lynley Dodd",
  "publisher": "Mallinson Rendel",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "동물",
   "유머",
   "자연",
   "일상"
  ],
  "mood": [
   "웃긴",
   "모험"
  ],
  "blurb": "동네 개들을 이끌고 거리를 누비던 헤어리 매클레리가 고양이 한 마리에 혼비백산하는 운율 코미디예요.",
  "readAloud": "개 이름이 줄줄이 이어지는 후렴을 리듬을 타며 빠르게 읽어 보세요.",
  "cover": {
   "emoji": "🐕",
   "palette": [
    "#5b5b5b",
    "#e8c07a"
   ]
  },
  "isbn": "9780140509380",
  "source": "curated",
  "quality": 0.7
 },
 {
  "id": "en-aliens-underpants",
  "lang": "en",
  "title": "Aliens Love Underpants",
  "author": "Claire Freedman & Ben Cort",
  "publisher": "Simon & Schuster",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "우주",
   "유머",
   "환상",
   "모험"
  ],
  "mood": [
   "웃긴",
   "모험"
  ],
  "blurb": "팬티를 모으러 지구에 오는 외계인들의 엉뚱한 이야기로, 우주와 웃음을 동시에 좋아하는 아이에게 딱이에요.",
  "readAloud": "외계인 우주선이 착륙하는 장면을 \"삐용삐용\" 효과음으로 살려 보세요.",
  "cover": {
   "emoji": "👽",
   "palette": [
    "#7fb069",
    "#a0d8ef"
   ]
  },
  "isbn": "9781416917045",
  "source": "curated",
  "quality": 0.7
 },
 {
  "id": "en-rosie-walk",
  "lang": "en",
  "title": "Rosie's Walk",
  "author": "Pat Hutchins",
  "publisher": "Macmillan",
  "ages": [
   "0-2",
   "3-4"
  ],
  "level": "그림책",
  "themes": [
   "동물",
   "유머",
   "자연",
   "일상"
  ],
  "mood": [
   "웃긴",
   "잔잔한"
  ],
  "blurb": "암탉 로지가 산책하는 동안 뒤에서 쫓던 여우가 줄줄이 사고를 당하는, 글과 그림의 반전이 재미있는 책이에요.",
  "readAloud": "글에 없는 여우의 수난을 그림에서 찾아 \"어, 여우 봐!\" 하고 짚어 주세요.",
  "cover": {
   "emoji": "🐔",
   "palette": [
    "#e8a04b",
    "#7fb069"
   ]
  },
  "isbn": "9780020437505",
  "source": "curated",
  "quality": 0.7
 },
 {
  "id": "en-snowman",
  "lang": "en",
  "title": "The Snowman",
  "author": "Raymond Briggs",
  "publisher": "Hamish Hamilton",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "환상",
   "자연",
   "모험",
   "감정"
  ],
  "mood": [
   "잔잔한",
   "모험"
  ],
  "blurb": "눈사람과 하늘을 나는 소년의 환상적인 밤을 글 없이 그림만으로 그린, 겨울의 고전이에요.",
  "readAloud": "글이 없으니 그림을 보며 둘이서 이야기를 만들어 읽어 보세요.",
  "cover": {
   "emoji": "⛄",
   "palette": [
    "#3a5a8a",
    "#eef3f6"
   ]
  },
  "isbn": "9780241302651",
  "source": "curated",
  "quality": 0.7
 },
 {
  "id": "en-very-quiet-cricket",
  "lang": "en",
  "title": "The Very Quiet Cricket",
  "author": "Eric Carle",
  "publisher": "Philomel Books",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "동물",
   "자연",
   "감정",
   "음식"
  ],
  "mood": [
   "잔잔한",
   "학습"
  ],
  "blurb": "소리를 내지 못하던 귀뚜라미가 마침내 노래하게 되는 이야기로, 마지막 페이지의 실제 소리가 깜짝 선물이에요.",
  "readAloud": "여러 곤충의 울음소리를 입으로 흉내 내며 등장시켜 보세요.",
  "cover": {
   "emoji": "🦗",
   "palette": [
    "#5a8f3c",
    "#e8c07a"
   ]
  },
  "isbn": "9780399226847",
  "source": "curated",
  "quality": 0.7
 },
 {
  "id": "en-windy-day",
  "lang": "en",
  "title": "Oi Frog!",
  "author": "Kes Gray & Jim Field",
  "publisher": "Hodder Children's Books",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "동물",
   "유머",
   "숫자/글자"
  ],
  "mood": [
   "웃긴",
   "학습"
  ],
  "blurb": "어떤 동물이 어디에 앉아야 하는지 라임으로 정해 주는 고양이와 개구리의 말장난이 아이의 영어 라임 감각을 키워요.",
  "readAloud": "라임 단어 앞에서 멈춰 아이가 어울리는 단어를 맞히게 해 보세요.",
  "cover": {
   "emoji": "🐸",
   "palette": [
    "#5cb85c",
    "#e8595e"
   ]
  },
  "isbn": "9781444910865",
  "source": "curated",
  "quality": 0.7
 },
 {
  "id": "ko-또야-너구리가-기운-바지를-입었어요-c76e",
  "lang": "ko",
  "title": "또야 너구리가 기운 바지를 입었어요",
  "author": "권정생",
  "publisher": "우리교육",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "동물",
   "가족",
   "감정",
   "일상"
  ],
  "mood": [
   "따뜻한",
   "잔잔한"
  ],
  "blurb": "엄마가 정성껏 기워준 바지를 입고 나간 또야 너구리의 이야기로, 가난하지만 따뜻한 가족의 사랑과 자존감을 잔잔하게 전해 줍니다.",
  "readAloud": "헌 바지를 기워 입는 또야의 마음을 함께 느껴 보며 \"너는 어떤 것이 소중하니?\" 하고 아이에게 물어보세요.",
  "cover": {
   "emoji": "🦝",
   "palette": [
    "#A0522D",
    "#F5DEB3"
   ]
  },
  "quality": 0.88,
  "source": "curated"
 },
 {
  "id": "ko-황소-아저씨-747f",
  "lang": "ko",
  "title": "황소 아저씨",
  "author": "권정생",
  "publisher": "길벗어린이",
  "ages": [
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "동물",
   "가족",
   "감정",
   "일상"
  ],
  "mood": [
   "따뜻한",
   "잔잔한"
  ],
  "blurb": "묵묵히 일만 하다 떠나간 황소 아저씨를 그리워하는 아이의 마음을 통해, 소박하지만 깊은 생명의 소중함과 이별의 슬픔을 잔잔하게 전해 주는 작품입니다.",
  "readAloud": "황소가 등장하는 장면에서 목소리를 낮고 천천히 읽어 주면 아이가 황소의 무게감과 따뜻함을 더 깊이 느낄 수 있어요.",
  "cover": {
   "emoji": "🐂",
   "palette": [
    "#8B4513",
    "#F5F0E8"
   ]
  },
  "quality": 0.92,
  "source": "curated"
 },
 {
  "id": "ko-엄마-까투리-8d21",
  "lang": "ko",
  "title": "엄마 까투리",
  "author": "권정생",
  "publisher": "낮은산",
  "ages": [
   "3-4",
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "가족",
   "동물",
   "자연",
   "감정"
  ],
  "mood": [
   "따뜻한",
   "잔잔한"
  ],
  "blurb": "산불 속에서도 새끼들을 온몸으로 품어 지켜내는 엄마 까투리의 이야기로, 위대한 모성애를 깊고 따뜻하게 전합니다.",
  "readAloud": "엄마 까투리의 마음을 느끼며 천천히, 목소리에 감정을 실어 읽어 주세요.",
  "cover": {
   "emoji": "🐦",
   "palette": [
    "#4a7c3f",
    "#d4a853"
   ]
  },
  "quality": 0.92,
  "source": "curated"
 },
 {
  "id": "ko-길-아저씨-손-아저씨-39c3",
  "lang": "ko",
  "title": "길 아저씨 손 아저씨",
  "author": "권정생",
  "publisher": "국민서관",
  "ages": [
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "가족",
   "감정",
   "일상",
   "친구"
  ],
  "mood": [
   "따뜻한",
   "잔잔한"
  ],
  "blurb": "전쟁으로 두 팔을 잃은 아저씨와 두 다리를 잃은 아저씨가 서로 의지하며 살아가는 이야기로, 나눔과 연대의 소중함을 따뜻하게 일깨워 줍니다.",
  "readAloud": "읽기 전 \"내가 누군가를 도와준 적이 있나요?\" 하고 먼저 물어보면 아이가 이야기 속으로 더 깊이 들어올 수 있어요.",
  "cover": {
   "emoji": "🤝",
   "palette": [
    "#D4E8C2",
    "#F5A623"
   ]
  },
  "quality": 0.92,
  "source": "curated"
 },
 {
  "id": "ko-곰이와-오푼돌이-아저씨-27e1",
  "lang": "ko",
  "title": "곰이와 오푼돌이 아저씨",
  "author": "권정생",
  "publisher": "보리",
  "ages": [
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "가족",
   "친구",
   "감정",
   "일상"
  ],
  "mood": [
   "따뜻한",
   "잔잔한"
  ],
  "blurb": "가난하지만 따뜻한 마음을 가진 곰이와 오푼돌이 아저씨의 이야기로, 소박한 삶 속에서 나눔과 정(情)의 소중함을 느끼게 해 줍니다.",
  "readAloud": "읽으면서 \"너라면 어떻게 했을까?\" 하고 아이에게 물어보며 나눔의 의미를 함께 이야기해 보세요.",
  "cover": {
   "emoji": "🐻",
   "palette": [
    "#7BAF7B",
    "#F5E6C8"
   ]
  },
  "quality": 0.8,
  "source": "curated"
 },
 {
  "id": "ko-동물원-4222",
  "lang": "ko",
  "title": "동물원",
  "author": "이수지",
  "publisher": "비룡소",
  "ages": [
   "3-4",
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "동물",
   "가족",
   "일상",
   "환상"
  ],
  "mood": [
   "잔잔한",
   "따뜻한"
  ],
  "blurb": "가족과 함께 동물원에 간 하루를 담은 그림책으로, 아이의 시선으로 바라본 동물들과 일상의 풍경이 섬세한 그림으로 펼쳐집니다. 말보다 그림이 더 많은 것을 이야기하는, 조용하지만 깊은 여운을 남기는 작품입니다.",
  "readAloud": "페이지를 넘기며 \"여기서 뭐가 보여?\" 하고 아이가 직접 그림 속 동물과 인물을 찾아 이야기하게 해 보세요.",
  "cover": {
   "emoji": "🦁",
   "palette": [
    "#4A7C59",
    "#F5E6C8"
   ]
  },
  "quality": 0.92,
  "source": "curated"
 },
 {
  "id": "ko-거울속으로-cef0",
  "lang": "ko",
  "title": "거울속으로",
  "author": "이수지",
  "publisher": "비룡소",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "환상",
   "가족",
   "일상",
   "감정"
  ],
  "mood": [
   "잔잔한",
   "따뜻한"
  ],
  "blurb": "거울 속 세상과 현실 세상이 맞닿는 신비로운 순간을 섬세한 그림으로 담아낸 작품으로, 아이의 상상력과 내면의 감성을 조용히 두드립니다.",
  "readAloud": "책을 펼쳐 거울 면이 만나는 부분을 손가락으로 짚어가며 \"이쪽이랑 저쪽이 어떻게 다를까?\" 하고 함께 찾아보세요.",
  "cover": {
   "emoji": "🪞",
   "palette": [
    "#C8D8E8",
    "#F5ECD7"
   ]
  },
  "quality": 0.92,
  "source": "curated"
 },
 {
  "id": "ko-여름이-온다-e412",
  "lang": "ko",
  "title": "여름이 온다",
  "author": "이수지",
  "publisher": "비룡소",
  "ages": [
   "3-4",
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "자연",
   "일상",
   "감정"
  ],
  "mood": [
   "잔잔한",
   "따뜻한"
  ],
  "blurb": "소나기가 쏟아지는 여름날, 아이들이 물속에서 신나게 뛰노는 순간을 이수지 작가 특유의 감각적인 그림으로 담아낸 작품입니다. 계절의 생동감과 여름의 설렘이 페이지마다 가득 차오릅니다.",
  "readAloud": "책을 읽으며 \"너도 여름에 물놀이해 본 적 있어?\" 하고 아이의 여름 추억을 함께 이야기해 보세요.",
  "cover": {
   "emoji": "☀️",
   "palette": [
    "#4FC3F7",
    "#FFF176"
   ]
  },
  "quality": 0.93,
  "source": "curated"
 },
 {
  "id": "ko-메리-0919",
  "lang": "ko",
  "title": "메리",
  "author": "안녕달",
  "publisher": "사계절",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "동물",
   "가족",
   "감정",
   "일상"
  ],
  "mood": [
   "따뜻한",
   "잔잔한"
  ],
  "blurb": "주인공과 강아지 메리의 따뜻한 교감을 섬세한 그림으로 담아낸 작품으로, 말하지 않아도 전해지는 사랑과 이별의 감정을 어린이의 눈높이에서 조용하게 이야기합니다.",
  "readAloud": "메리와 주인공이 함께하는 장면에서 아이에게 \"너도 이런 친구가 있어?\" 하고 물어보며 감정을 나눠 보세요.",
  "cover": {
   "emoji": "🐕",
   "palette": [
    "#D6C4A1",
    "#7A9E87"
   ]
  },
  "quality": 0.88,
  "source": "curated"
 },
 {
  "id": "ko-세상에서-제일-힘센-수탉-3db9",
  "lang": "ko",
  "title": "세상에서 제일 힘센 수탉",
  "author": "이억배",
  "publisher": "재미마주",
  "ages": [
   "3-4",
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "동물",
   "유머",
   "감정",
   "가족"
  ],
  "mood": [
   "웃긴",
   "따뜻한"
  ],
  "blurb": "세상에서 제일 힘이 세다고 으스대는 수탉이 차례차례 더 강한 존재를 만나며 좌충우돌 벌어지는 이야기로, 허풍과 용기 사이에서 웃음과 따뜻함을 동시에 선사합니다.",
  "readAloud": "수탉이 뽐내는 장면마다 아이와 함께 목청껏 \"나는 세상에서 제일 힘이 세!\" 하고 따라 외쳐 보세요.",
  "cover": {
   "emoji": "🐓",
   "palette": [
    "#E83B1E",
    "#F5C842"
   ]
  },
  "quality": 0.88,
  "source": "curated"
 },
 {
  "id": "ko-비무장지대에-봄이-오면-d010",
  "lang": "ko",
  "title": "비무장지대에 봄이 오면",
  "author": "이억배",
  "publisher": "사계절",
  "ages": [
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "자연",
   "동물",
   "가족",
   "모험"
  ],
  "mood": [
   "잔잔한",
   "따뜻한"
  ],
  "blurb": "사람의 발길이 닿지 않는 비무장지대(DMZ)에 살아 숨 쉬는 동식물들의 이야기를 통해, 평화와 자연의 소중함을 조용하고 깊게 전하는 그림책입니다.",
  "readAloud": "봄·여름·가을·겨울 계절이 바뀌는 장면마다 잠시 멈추고, 아이에게 \"어떤 동물이 보여?\" 하고 그림 속 생명들을 함께 찾아보세요.",
  "cover": {
   "emoji": "🌿",
   "palette": [
    "#6BAF72",
    "#C9E0A3"
   ]
  },
  "quality": 0.88,
  "source": "curated"
 },
 {
  "id": "ko-내-짝궁-최영대-d315",
  "lang": "ko",
  "title": "내 짝궁 최영대",
  "author": "채인선",
  "publisher": "재미마주",
  "ages": [
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "친구",
   "감정",
   "일상",
   "가족"
  ],
  "mood": [
   "따뜻한",
   "잔잔한"
  ],
  "blurb": "냄새나고 이상한 아이라고 놀림받던 최영대와 조금씩 친구가 되어가는 이야기로, 다름을 받아들이고 진짜 우정이 무엇인지 조용하고 깊게 일깨워 줍니다.",
  "readAloud": "읽다가 \"너라면 영대한테 어떻게 했을 것 같아?\" 하고 물어보며 아이의 마음을 열어 보세요.",
  "cover": {
   "emoji": "🤝",
   "palette": [
    "#F4C97A",
    "#7DAFCF"
   ]
  },
  "quality": 0.92,
  "source": "curated"
 },
 {
  "id": "ko-엄마가-화났다-4135",
  "lang": "ko",
  "title": "엄마가 화났다",
  "author": "최숙희",
  "publisher": "책읽는곰",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "감정",
   "가족",
   "일상"
  ],
  "mood": [
   "따뜻한",
   "웃긴"
  ],
  "blurb": "엄마도 화가 날 때가 있어요! 엄마의 다양한 화난 표정과 아이의 눈으로 바라보는 솔직한 감정을 통해, 서로의 마음을 이해하고 화해하는 따뜻한 이야기예요.",
  "readAloud": "엄마의 화난 표정 페이지에서 아이와 함께 \"엄마가 왜 화났을까?\" 이야기 나눠 보세요.",
  "cover": {
   "emoji": "😤",
   "palette": [
    "#F4A261",
    "#264653"
   ]
  },
  "quality": 0.82,
  "source": "curated"
 },
 {
  "id": "ko-너는-기적이야-b797",
  "lang": "ko",
  "title": "너는 기적이야",
  "author": "최숙희",
  "publisher": "책읽는곰",
  "ages": [
   "0-2",
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "가족",
   "감정",
   "일상"
  ],
  "mood": [
   "따뜻한",
   "잔잔한"
  ],
  "blurb": "태어난 것만으로도 이미 기적인 아이에게 엄마·아빠가 건네는 사랑의 말을 담은 그림책으로, 아이의 존재 자체를 온전히 긍정하고 축복해 줍니다.",
  "readAloud": "아이의 이름을 넣어 \"○○야, 너는 기적이야\"라고 읽어 주면 감동이 두 배예요.",
  "cover": {
   "emoji": "🌟",
   "palette": [
    "#F9C6D0",
    "#FFF8E7"
   ]
  },
  "quality": 0.91,
  "source": "curated"
 },
 {
  "id": "ko-지하-정원-6742",
  "lang": "ko",
  "title": "지하 정원",
  "author": "이지은",
  "publisher": "보림",
  "ages": [
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "자연",
   "환상",
   "가족",
   "감정"
  ],
  "mood": [
   "잔잔한",
   "따뜻한"
  ],
  "blurb": "땅속 깊은 곳에 펼쳐진 신비로운 정원을 통해, 잃어버린 것들과 마음속 그리움을 조용히 들여다보는 그림책입니다.",
  "readAloud": "책을 읽으며 \"너라면 지하 정원에 무엇을 심고 싶어?\" 하고 아이에게 물어보세요.",
  "cover": {
   "emoji": "🌱",
   "palette": [
    "#4a7c59",
    "#d4b896"
   ]
  },
  "quality": 0.88,
  "source": "curated"
 },
 {
  "id": "ko-팥빙수의-전설-b16d",
  "lang": "ko",
  "title": "팥빙수의 전설",
  "author": "이지은",
  "publisher": "웅진주니어",
  "ages": [
   "3-4",
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "음식",
   "환상",
   "동물",
   "유머"
  ],
  "mood": [
   "웃긴",
   "따뜻한"
  ],
  "blurb": "무더운 여름, 팥빙수를 먹고 싶은 호랑이와 친구들이 펼치는 좌충우돌 소동을 통해 나눔과 협동의 기쁨을 유쾌하게 전해주는 그림책입니다.",
  "readAloud": "호랑이가 팥빙수를 외치는 장면에서 목소리를 크고 우렁차게 바꿔 읽어 주면 아이들이 더욱 즐거워해요!",
  "cover": {
   "emoji": "🍧",
   "palette": [
    "#E8524A",
    "#AEE0F5"
   ]
  },
  "quality": 0.88,
  "source": "curated"
 },
 {
  "id": "ko-지하철을-타고서-7237",
  "lang": "ko",
  "title": "지하철을 타고서",
  "author": "고대영",
  "publisher": "길벗어린이",
  "ages": [
   "3-4",
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "탈것",
   "일상",
   "가족",
   "감정"
  ],
  "mood": [
   "따뜻한",
   "잔잔한"
  ],
  "blurb": "지하철을 타고 여행하는 일상 속에서 다양한 사람들과 도시의 풍경을 따뜻하게 담아낸 그림책으로, 아이들에게 지하철이라는 친근한 탈것과 도시 생활을 자연스럽게 소개해 줍니다.",
  "readAloud": "실제 지하철 노선도나 소리를 함께 보여 주며 읽으면 아이의 상상력과 호기심이 쑥쑥 자라요!",
  "cover": {
   "emoji": "🚇",
   "palette": [
    "#2563EB",
    "#F5F0E8"
   ]
  },
  "quality": 0.82,
  "source": "curated"
 },
 {
  "id": "ko-개구리네-한솥밥-7e70",
  "lang": "ko",
  "title": "개구리네 한솥밥",
  "author": "백석",
  "publisher": "보림",
  "ages": [
   "3-4",
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "동물",
   "음식",
   "가족",
   "친구"
  ],
  "mood": [
   "따뜻한",
   "잔잔한"
  ],
  "blurb": "시인 백석의 시를 원작으로, 숲속 동물들이 함께 밥을 나눠 먹는 정겨운 이야기를 담은 그림책이에요. 나눔과 정(情)의 아름다움을 구수한 우리말로 느낄 수 있어요.",
  "readAloud": "밥을 먹으며 함께 읽어보세요 — \"우리도 나눠 먹을까?\" 한 마디가 식탁을 더 따뜻하게 만들어줄 거예요.",
  "cover": {
   "emoji": "🐸",
   "palette": [
    "#6BAF6B",
    "#F5E6C8"
   ]
  },
  "quality": 0.88,
  "source": "curated"
 },
 {
  "id": "ko-준치가시-56ac",
  "lang": "ko",
  "title": "준치가시",
  "author": "백석",
  "publisher": "창비",
  "ages": [
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "동물",
   "음식",
   "환상",
   "가족"
  ],
  "mood": [
   "따뜻한",
   "잔잔한"
  ],
  "blurb": "시인 백석의 문학적인 언어로 빚어낸 옛이야기로, 준치 가시에 얽힌 신비로운 유래를 통해 자연과 생명의 소중함을 느낄 수 있어요.",
  "readAloud": "백석 특유의 방언과 리드미컬한 문체를 살려 천천히, 노래 읽듯 낭독해 보세요.",
  "cover": {
   "emoji": "🐟",
   "palette": [
    "#5B8DB8",
    "#F4E4C1"
   ]
  },
  "quality": 0.8,
  "source": "curated"
 },
 {
  "id": "ko-꽃을-선물할게-72cd",
  "lang": "ko",
  "title": "꽃을 선물할게",
  "author": "강경수",
  "publisher": "창비",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "가족",
   "친구",
   "감정",
   "자연"
  ],
  "mood": [
   "따뜻한",
   "잔잔한"
  ],
  "blurb": "소중한 사람에게 꽃을 선물하고 싶은 마음을 담은 그림책으로, 사랑과 감사의 감정을 따뜻하게 전달해 줍니다.",
  "readAloud": "\"너한테 꽃을 선물하고 싶을 때는 언제야?\" 하고 아이에게 물어보며 함께 이야기 나눠 보세요.",
  "cover": {
   "emoji": "🌸",
   "palette": [
    "#F9C6D0",
    "#A8D8A8"
   ]
  },
  "quality": 0.78,
  "source": "curated"
 },
 {
  "id": "ko-눈물바다-64ea",
  "lang": "ko",
  "title": "눈물바다",
  "author": "서현",
  "publisher": "사계절",
  "ages": [
   "3-4",
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "감정",
   "환상",
   "가족",
   "일상"
  ],
  "mood": [
   "잔잔한",
   "따뜻한"
  ],
  "blurb": "엄마한테 혼난 날, 주인공이 엉엉 울다 보니 눈물이 온 세상을 가득 채우는 바다가 되어버려요. 아이의 크고 뜨거운 감정을 판타지로 풀어낸 따뜻한 그림책이에요.",
  "readAloud": "아이가 많이 울었던 날을 떠올리며 \"너도 이런 날 있었어?\" 하고 물어보세요.",
  "cover": {
   "emoji": "😭",
   "palette": [
    "#5B8FC9",
    "#F7E6C2"
   ]
  },
  "quality": 0.92,
  "source": "curated"
 },
 {
  "id": "ko-간질간질-a506",
  "lang": "ko",
  "title": "간질간질",
  "author": "서현",
  "publisher": "사계절",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "감정",
   "일상",
   "동물",
   "친구"
  ],
  "mood": [
   "웃긴",
   "따뜻한"
  ],
  "blurb": "온몸이 간질간질해지는 느낌을 유쾌하고 감각적으로 담아낸 그림책으로, 아이들이 일상 속 작은 감각과 감정을 재미있게 발견하게 해줍니다.",
  "readAloud": "아이와 함께 \"간질간질~\" 소리를 내며 실제로 간지럼을 태워 주면 책 속 느낌이 온몸으로 전해져요!",
  "cover": {
   "emoji": "🪶",
   "palette": [
    "#F9E04B",
    "#A8D8A8"
   ]
  },
  "quality": 0.82,
  "source": "curated"
 },
 {
  "id": "ko-왜-띄어-써야-돼-bcdb",
  "lang": "ko",
  "title": "왜 띄어 써야 돼?",
  "author": "박규빈",
  "publisher": "길벗어린이",
  "ages": [
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "숫자/글자",
   "유머",
   "일상"
  ],
  "mood": [
   "웃긴",
   "학습"
  ],
  "blurb": "띄어쓰기를 안 하면 뜻이 완전히 달라진다는 사실을 유쾌한 이야기로 보여 주는 책으로, 읽으면서 자연스럽게 우리말 맞춤법의 재미를 느낄 수 있어요.",
  "readAloud": "한 문장씩 띄어쓰기 전·후를 번갈아 읽어 주면 아이가 뜻 차이를 직접 발견하며 깔깔 웃을 수 있어요!",
  "cover": {
   "emoji": "✏️",
   "palette": [
    "#F9E04B",
    "#4A90D9"
   ]
  },
  "quality": 0.72,
  "source": "curated"
 },
 {
  "id": "ko-감기-걸린-물고기-60df",
  "lang": "ko",
  "title": "감기 걸린 물고기",
  "author": "박정섭",
  "publisher": "사계절",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "동물",
   "감정",
   "친구",
   "유머"
  ],
  "mood": [
   "웃긴",
   "따뜻한"
  ],
  "blurb": "물속에서 감기에 걸린 물고기라는 엉뚱한 상상에서 시작해, 친구를 걱정하고 돌봐 주는 따뜻한 마음을 유머러스하게 담아낸 그림책입니다.",
  "readAloud": "물고기가 재채기하는 장면에서 아이와 함께 \"에취!\" 소리를 크게 내 보세요!",
  "cover": {
   "emoji": "🐟",
   "palette": [
    "#5BC8E8",
    "#F7A98B"
   ]
  },
  "quality": 0.88,
  "source": "curated"
 },
 {
  "id": "ko-꽁꽁꽁-4858",
  "lang": "ko",
  "title": "꽁꽁꽁",
  "author": "윤정주",
  "publisher": "책읽는곰",
  "ages": [
   "0-2",
   "3-4"
  ],
  "level": "보드북",
  "themes": [
   "동물",
   "자연",
   "일상"
  ],
  "mood": [
   "잔잔한",
   "따뜻한"
  ],
  "blurb": "추운 겨울, 꽁꽁 언 세상 속에서 동물 친구들이 따뜻하게 몸을 녹이는 모습을 리듬감 있는 의성어·의태어로 담아낸 그림책입니다. \"꽁꽁꽁\"이라는 말의 재미가 아이의 언어 감각을 깨워줍니다.",
  "readAloud": "\"꽁꽁꽁!\" 부분에서 목소리를 잔뜩 떨며 춥게 읽어 주면 아이가 깔깔 웃으며 함께 따라 해요.",
  "cover": {
   "emoji": "🥶",
   "palette": [
    "#A8D8EA",
    "#FFFFFF"
   ]
  },
  "quality": 0.78,
  "source": "curated"
 },
 {
  "id": "ko-우리-가족입니다-6cd4",
  "lang": "ko",
  "title": "우리 가족입니다",
  "author": "이혜란",
  "publisher": "보림",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "가족",
   "일상",
   "감정"
  ],
  "mood": [
   "따뜻한",
   "잔잔한"
  ],
  "blurb": "할머니부터 아기까지, 저마다 다른 우리 가족의 모습을 따뜻하고 정겨운 그림으로 담아낸 책이에요. 읽고 나면 내 가족이 더욱 소중하게 느껴질 거예요.",
  "readAloud": "책을 읽으며 \"우리 가족은 누가 있지?\" 하고 아이와 함께 가족 한 명 한 명을 떠올려 보세요.",
  "cover": {
   "emoji": "👨‍👩‍👧‍👦",
   "palette": [
    "#F4A261",
    "#FDEBD0"
   ]
  },
  "quality": 0.82,
  "source": "curated"
 },
 {
  "id": "ko-기차-9d5a",
  "lang": "ko",
  "title": "기차 ㄱㄴㄷ",
  "author": "박은영",
  "publisher": "비룡소",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "숫자/글자",
   "탈것",
   "일상"
  ],
  "mood": [
   "학습",
   "따뜻한"
  ],
  "blurb": "기차를 타고 달리며 ㄱ부터 ㅎ까지 한글 자음을 자연스럽게 익히는 그림책으로, 생동감 넘치는 그림과 재미있는 낱말들이 아이의 한글 첫걸음을 즐겁게 이끌어 줍니다.",
  "readAloud": "기차 소리 \"칙칙폭폭\"을 함께 흉내 내며 각 자음 페이지의 낱말을 아이와 번갈아 읽어 보세요!",
  "cover": {
   "emoji": "🚂",
   "palette": [
    "#E8333A",
    "#F5E642"
   ]
  },
  "quality": 0.88,
  "source": "curated"
 },
 {
  "id": "ko-검피-아저씨의-뱃놀이-03da",
  "lang": "ko",
  "title": "검피 아저씨의 뱃놀이",
  "author": "존 버닝햄",
  "publisher": "시공주니어",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "동물",
   "모험",
   "가족",
   "자연"
  ],
  "mood": [
   "따뜻한",
   "웃긴"
  ],
  "blurb": "검피 아저씨의 배에 아이들과 동물 친구들이 하나둘 올라타다가 결국 모두 물에 빠지고 마는, 유쾌하면서도 따뜻한 이야기예요. 실수해도 괜찮다는 너그러운 마음을 자연스럽게 배울 수 있어요.",
  "readAloud": "동물들이 배에 탈 때마다 \"안 돼요!\" 하고 아이와 함께 외쳐 보고, 결말에서 검피 아저씨의 반응을 흉내 내며 읽어 주세요.",
  "cover": {
   "emoji": "⛵",
   "palette": [
    "#7EC8E3",
    "#F5D08A"
   ]
  },
  "quality": 0.97,
  "source": "curated"
 },
 {
  "id": "ko-셜리야-물가에-가지-마-017b",
  "lang": "ko",
  "title": "셜리야, 물가에 가지 마!",
  "author": "존 버닝햄",
  "publisher": "비룡소",
  "ages": [
   "3-4",
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "환상",
   "가족",
   "모험",
   "일상"
  ],
  "mood": [
   "잔잔한",
   "모험"
  ],
  "blurb": "해변에 놀러 간 셜리가 상상 속 대모험을 펼치는 동안, 엄마는 현실의 잔소리를 늘어놓는 두 세계가 한 화면에 절묘하게 펼쳐지는 그림책입니다.",
  "readAloud": "왼쪽 엄마 말과 오른쪽 셜리의 상상을 번갈아 읽어 주며 아이와 어느 세계가 더 재미있는지 이야기 나눠 보세요.",
  "cover": {
   "emoji": "🌊",
   "palette": [
    "#4A90D9",
    "#F5E6C8"
   ]
  },
  "quality": 0.95,
  "source": "curated"
 },
 {
  "id": "ko-야-우리-기차에서-내려-dbc3",
  "lang": "ko",
  "title": "야, 우리 기차에서 내려!",
  "author": "존 버닝햄",
  "publisher": "비룡소",
  "ages": [
   "3-4",
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "동물",
   "환상",
   "모험",
   "자연"
  ],
  "mood": [
   "따뜻한",
   "모험"
  ],
  "blurb": "잠자리에 들기 싫은 아이가 꿈속 기차 여행을 떠나며 멸종 위기 동물들을 만나는 이야기로, 환경 보호의 소중함을 따뜻하게 일깨워 줍니다.",
  "readAloud": "기차에 올라타는 동물이 등장할 때마다 \"이 동물은 왜 쫓겨나고 있을까?\" 아이와 함께 이야기 나눠 보세요.",
  "cover": {
   "emoji": "🚂",
   "palette": [
    "#2E6B3E",
    "#F5C842"
   ]
  },
  "quality": 0.92,
  "source": "curated"
 },
 {
  "id": "ko-에드와르도-세상에서-가장-못된-아이-401c",
  "lang": "ko",
  "title": "에드와르도 세상에서 가장 못된 아이",
  "author": "존 버닝햄",
  "publisher": "비룡소",
  "ages": [
   "3-4",
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "감정",
   "가족",
   "일상",
   "유머"
  ],
  "mood": [
   "따뜻한",
   "웃긴"
  ],
  "blurb": "어른의 말 한마디가 아이를 '못된 아이'로도, '착한 아이'로도 만든다는 것을 유쾌하게 보여 주는 책으로, 칭찬과 격려의 힘을 따뜻하게 일깨워 줍니다.",
  "readAloud": "에드와르도가 꾸중 들을 때와 칭찬 받을 때 목소리 톤을 달리해서 읽어 주면 아이가 감정 변화를 더 생생하게 느낄 수 있어요.",
  "cover": {
   "emoji": "😈",
   "palette": [
    "#F4A620",
    "#4A90D9"
   ]
  },
  "quality": 0.91,
  "source": "curated"
 },
 {
  "id": "ko-당나귀-실베스터와-요술-조약돌-0243",
  "lang": "ko",
  "title": "당나귀 실베스터와 요술 조약돌",
  "author": "윌리엄 스타이그",
  "publisher": "비룡소",
  "ages": [
   "3-4",
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "환상",
   "가족",
   "감정",
   "모험"
  ],
  "mood": [
   "따뜻한",
   "모험"
  ],
  "blurb": "요술 조약돌을 손에 쥔 당나귀 실베스터가 뜻밖의 소원을 빌어 바위로 변해 버리고, 그를 애타게 찾는 가족의 사랑이 잔잔하고 깊은 감동을 전합니다.",
  "readAloud": "\"만약 네가 소원을 하나 빌 수 있다면?\" 하고 아이에게 물어보며 함께 상상의 나래를 펼쳐 보세요.",
  "cover": {
   "emoji": "🪨",
   "palette": [
    "#D94F2B",
    "#5B8C3E"
   ]
  },
  "quality": 0.95,
  "source": "curated"
 },
 {
  "id": "ko-아모스와-보리스-2ce9",
  "lang": "ko",
  "title": "아모스와 보리스",
  "author": "윌리엄 스타이그",
  "publisher": "시공주니어",
  "ages": [
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "친구",
   "모험",
   "동물",
   "자연"
  ],
  "mood": [
   "따뜻한",
   "모험"
  ],
  "blurb": "작은 생쥐 아모스와 거대한 고래 보리스, 전혀 다른 두 존재가 바다 위에서 나눈 우정과 서로를 향한 헌신을 감동적으로 그려낸 작품입니다. 진정한 우정이란 크기나 모습이 아닌 마음에서 비롯된다는 것을 따뜻하게 전합니다.",
  "readAloud": "아모스와 보리스가 처음 만나는 장면에서 아이에게 \"이 둘이 친구가 될 수 있을까?\" 하고 물어보며 기대감을 높여 보세요.",
  "cover": {
   "emoji": "🐋",
   "palette": [
    "#1B6CA8",
    "#F5E6C8"
   ]
  },
  "quality": 0.92,
  "source": "curated"
 },
 {
  "id": "ko-슈렉-0445",
  "lang": "ko",
  "title": "슈렉!",
  "author": "윌리엄 스타이그",
  "publisher": "비룡소",
  "ages": [
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "환상",
   "모험",
   "유머",
   "감정"
  ],
  "mood": [
   "웃긴",
   "모험"
  ],
  "blurb": "못생기고 냄새나는 괴물 슈렉이 세상 밖으로 모험을 떠나며 자신만의 방식으로 당당하게 살아가는 이야기로, 다름과 개성을 유쾌하게 긍정합니다.",
  "readAloud": "슈렉의 엉뚱한 대사는 과장된 목소리로 읽어 주면 아이들이 깔깔 웃으며 더 즐거워해요!",
  "cover": {
   "emoji": "👹",
   "palette": [
    "#4CAF50",
    "#8B4513"
   ]
  },
  "quality": 0.88,
  "source": "curated"
 },
 {
  "id": "ko-으뜸-헤엄이-73b8",
  "lang": "ko",
  "title": "으뜸 헤엄이",
  "author": "레오 리오니",
  "publisher": "마루벌",
  "ages": [
   "3-4",
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "동물",
   "친구",
   "모험",
   "감정"
  ],
  "mood": [
   "따뜻한",
   "모험"
  ],
  "blurb": "작은 검정 물고기 헤엄이가 혼자서는 할 수 없는 일을 친구들과 힘을 모아 해내는, 협동과 용기의 감동적인 이야기입니다.",
  "readAloud": "큰 물고기가 나타나는 장면에서 목소리를 낮추고, 헤엄이가 아이디어를 떠올리는 순간엔 함께 \"그래, 바로 이거야!\" 하고 외쳐 보세요.",
  "cover": {
   "emoji": "🐟",
   "palette": [
    "#1A6B9A",
    "#E8E0C8"
   ]
  },
  "quality": 0.97,
  "source": "curated"
 },
 {
  "id": "ko-파랑이와-노랑이-e3ee",
  "lang": "ko",
  "title": "파랑이와 노랑이",
  "author": "레오 리오니",
  "publisher": "물구나무",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "친구",
   "감정",
   "환상",
   "일상"
  ],
  "mood": [
   "따뜻한",
   "웃긴"
  ],
  "blurb": "파랑이와 노랑이가 꼭 껴안으면 초록이 되어버리는 이 이야기는, 우정이 얼마나 깊어질 수 있는지를 색깔로 표현한 아름다운 그림책입니다.",
  "readAloud": "파란색과 노란색 물감이나 셀로판지를 준비해 아이와 직접 색을 섞으면서 읽으면 훨씬 생생한 경험이 돼요!",
  "cover": {
   "emoji": "🔵",
   "palette": [
    "#4A90D9",
    "#F5E642"
   ]
  },
  "quality": 0.95,
  "source": "curated"
 },
 {
  "id": "ko-고릴라-32e7",
  "lang": "ko",
  "title": "고릴라",
  "author": "앤서니 브라운",
  "publisher": "비룡소",
  "ages": [
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "동물",
   "가족",
   "감정",
   "환상"
  ],
  "mood": [
   "따뜻한",
   "잔잔한"
  ],
  "blurb": "동물원 고릴라를 갖고 싶어 하는 한나가 꿈속에서 진짜 고릴라와 함께 특별한 하루를 보내며, 아빠와의 진짜 사랑을 발견하는 이야기입니다.",
  "readAloud": "고릴라와 한나가 함께하는 장면마다 \"아빠랑 이런 거 해보고 싶어?\" 하고 아이에게 물어보세요!",
  "cover": {
   "emoji": "🦍",
   "palette": [
    "#1B4D2E",
    "#F5C842"
   ]
  },
  "quality": 0.97,
  "source": "curated"
 },
 {
  "id": "ko-터널-563b",
  "lang": "ko",
  "title": "터널",
  "author": "앤서니 브라운",
  "publisher": "논장",
  "ages": [
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "환상",
   "가족",
   "감정",
   "모험"
  ],
  "mood": [
   "따뜻한",
   "모험"
  ],
  "blurb": "사이좋지 않던 오빠와 동생이 어두운 터널을 통해 서로를 진심으로 이해하게 되는 감동적인 성장 이야기입니다.",
  "readAloud": "터널 속 장면에서 잠시 멈추고 \"네가 이 터널에 들어간다면 어떤 기분일까?\" 하고 아이에게 물어보세요.",
  "cover": {
   "emoji": "🌀",
   "palette": [
    "#5B3A8E",
    "#D9A84E"
   ]
  },
  "quality": 0.92,
  "source": "curated"
 },
 {
  "id": "ko-돼지책-b6c2",
  "lang": "ko",
  "title": "돼지책",
  "author": "앤서니 브라운",
  "publisher": "웅진주니어",
  "ages": [
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "가족",
   "일상",
   "감정",
   "유머"
  ],
  "mood": [
   "따뜻한",
   "웃긴"
  ],
  "blurb": "엄마가 집을 떠나자 아빠와 두 아들이 돼지로 변해가는 이야기로, 가족 안에서 당연하게 여겨졌던 엄마의 역할을 유쾌하면서도 따끔하게 돌아보게 합니다.",
  "readAloud": "\"너라면 어떻게 했을 것 같아?\" 하고 아이와 역할에 대해 자유롭게 이야기 나눠 보세요.",
  "cover": {
   "emoji": "🐷",
   "palette": [
    "#F4A460",
    "#FFFFFF"
   ]
  },
  "quality": 0.97,
  "source": "curated"
 },
 {
  "id": "ko-우리-엄마-3bb2",
  "lang": "ko",
  "title": "우리 엄마",
  "author": "앤서니 브라운",
  "publisher": "웅진주니어",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "가족",
   "감정",
   "환상",
   "일상"
  ],
  "mood": [
   "따뜻한",
   "웃긴"
  ],
  "blurb": "세상에서 가장 강하고, 아름답고, 마법 같은 존재—우리 엄마! 앤서니 브라운 특유의 유머러스하고 따뜻한 그림으로 엄마를 향한 아이의 사랑을 담뿍 담은 책이에요.",
  "readAloud": "\"우리 엄마는요~\"로 시작하는 문장을 아이와 함께 목소리를 높였다 낮췄다 하며 읽어 보세요!",
  "cover": {
   "emoji": "🌸",
   "palette": [
    "#F9A8D4",
    "#FFFFFF"
   ]
  },
  "quality": 0.95,
  "source": "curated"
 },
 {
  "id": "ko-우리-아빠-0aa9",
  "lang": "ko",
  "title": "우리 아빠",
  "author": "앤서니 브라운",
  "publisher": "웅진주니어",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "가족",
   "감정",
   "일상",
   "환상"
  ],
  "mood": [
   "따뜻한",
   "웃긴"
  ],
  "blurb": "아이의 눈에 비친 아빠는 세상에서 가장 힘세고, 재밌고, 멋진 존재! 앤서니 브라운 특유의 유머러스한 그림으로 아빠를 향한 무한한 사랑을 담아낸 책이에요.",
  "readAloud": "아이에게 \"우리 아빠는 어때요?\" 하고 물어보며 함께 페이지를 넘겨보세요.",
  "cover": {
   "emoji": "👨",
   "palette": [
    "#F4A825",
    "#FFFFFF"
   ]
  },
  "quality": 0.92,
  "source": "curated"
 },
 {
  "id": "ko-달라질-거야-340d",
  "lang": "ko",
  "title": "달라질 거야",
  "author": "앤서니 브라운",
  "publisher": "현암사",
  "ages": [
   "3-4",
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "가족",
   "감정",
   "일상"
  ],
  "mood": [
   "따뜻한",
   "잔잔한"
  ],
  "blurb": "앤서니 브라운 특유의 세밀하고 따뜻한 그림 속에서, 변화 앞에 선 아이의 설레임과 불안을 솔직하게 담아낸 그림책입니다. 새로운 환경에 적응해가는 아이의 감정에 깊이 공감하게 해줍니다.",
  "readAloud": "\"달라질 거야\"를 읽으며 아이에게 \"너는 어떤 게 달라지면 좋겠어?\"라고 물어보세요.",
  "cover": {
   "emoji": "🌱",
   "palette": [
    "#7DAF9C",
    "#F5E6C8"
   ]
  },
  "quality": 0.8,
  "source": "curated"
 },
 {
  "id": "ko-내-모자-어디-갔을까-d1ee",
  "lang": "ko",
  "title": "내 모자 어디 갔을까?",
  "author": "존 클라센",
  "publisher": "시공주니어",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "유머",
   "동물",
   "감정"
  ],
  "mood": [
   "웃긴",
   "잔잔한"
  ],
  "blurb": "곰이 잃어버린 모자를 찾아 여러 동물 친구들에게 물어보는 단순한 이야기 속에 반전과 유머가 숨어 있어, 아이들이 깔깔 웃으며 결말을 맞이하게 되는 그림책입니다.",
  "readAloud": "각 동물의 대사를 서로 다른 목소리로 흉내 내며 읽어 주세요—마지막 반전에서 아이의 반응을 기대하세요!",
  "cover": {
   "emoji": "🎩",
   "palette": [
    "#D95B2A",
    "#F5E6C8"
   ]
  },
  "quality": 0.95,
  "source": "curated"
 },
 {
  "id": "ko-이건-내-모자가-아니야-43ca",
  "lang": "ko",
  "title": "이건 내 모자가 아니야",
  "author": "존 클라센",
  "publisher": "시공주니어",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "유머",
   "동물",
   "감정"
  ],
  "mood": [
   "웃긴",
   "잔잔한"
  ],
  "blurb": "작은 물고기가 큰 물고기의 모자를 훔쳐 달아나며 \"이건 내 모자가 아니야\"라고 솔직하게 털어놓는 아이러니한 이야기로, 짧고 단순한 문장 속에 도덕적 질문과 블랙 유머가 절묘하게 담겨 있습니다.",
  "readAloud": "작은 물고기의 독백을 조마조마하고 작은 목소리로 읽어 주면 아이가 더욱 몰입해요!",
  "cover": {
   "emoji": "🎩",
   "palette": [
    "#1B3A5C",
    "#D4EAF7"
   ]
  },
  "quality": 0.98,
  "source": "curated"
 },
 {
  "id": "ko-모두-똥을-누어요-5c93",
  "lang": "ko",
  "title": "모두 똥을 누어요",
  "author": "고미 타로",
  "publisher": "한림출판사",
  "ages": [
   "0-2",
   "3-4"
  ],
  "level": "보드북",
  "themes": [
   "동물",
   "일상",
   "유머"
  ],
  "mood": [
   "웃긴",
   "따뜻한"
  ],
  "blurb": "코끼리도, 강아지도, 사람도 모두 똥을 눈다! 생명이 살아있다는 자연스럽고 유쾌한 진리를 아이의 눈높이에서 알려주는 사랑받는 그림책이에요.",
  "readAloud": "각 동물 페이지마다 \"이 친구도 똥을 눌까?\" 하고 물어보며 아이가 직접 대답하게 해 보세요!",
  "cover": {
   "emoji": "💩",
   "palette": [
    "#F4A836",
    "#6DBF67"
   ]
  },
  "quality": 0.95,
  "source": "curated"
 },
 {
  "id": "ko-이슬이의-첫-심부름-88cf",
  "lang": "ko",
  "title": "이슬이의 첫 심부름",
  "author": "쓰쓰이 요리코",
  "publisher": "한림출판사",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "일상",
   "가족",
   "감정"
  ],
  "mood": [
   "따뜻한",
   "모험"
  ],
  "blurb": "다섯 살 이슬이가 난생처음 혼자 우유를 사러 가는 두근두근 심부름 이야기로, 아이의 작은 용기와 성취감을 따뜻하게 담아냈습니다.",
  "readAloud": "심부름을 마친 이슬이에게 \"너라면 어떤 기분이었을까?\"라고 물어보며 아이의 경험과 연결해 주세요.",
  "cover": {
   "emoji": "🥛",
   "palette": [
    "#F9E4B7",
    "#A8D8A8"
   ]
  },
  "quality": 0.95,
  "source": "curated"
 },
 {
  "id": "ko-순이와-어린-동생-1672",
  "lang": "ko",
  "title": "순이와 어린 동생",
  "author": "쓰쓰이 요리코",
  "publisher": "한림출판사",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "가족",
   "감정",
   "일상",
   "친구"
  ],
  "mood": [
   "따뜻한",
   "잔잔한"
  ],
  "blurb": "엄마가 갓난 동생을 돌보느라 바쁜 날, 순이는 외롭고 샘이 나지만 결국 동생을 향한 따뜻한 마음을 발견해요. 새 동생이 생긴 아이라면 누구나 공감할 섬세한 감정 이야기입니다.",
  "readAloud": "\"순이가 어떤 기분이었을 것 같아?\" 하고 아이의 감정을 함께 이야기하며 읽어 보세요.",
  "cover": {
   "emoji": "👶",
   "palette": [
    "#F9E4B7",
    "#D98CA0"
   ]
  },
  "quality": 0.88,
  "source": "curated"
 },
 {
  "id": "ko-100만-번-산-고양이-9a18",
  "lang": "ko",
  "title": "100만 번 산 고양이",
  "author": "사노 요코",
  "publisher": "비룡소",
  "ages": [
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "동물",
   "감정",
   "가족",
   "환상"
  ],
  "mood": [
   "잔잔한",
   "따뜻한"
  ],
  "blurb": "100만 번을 살고 죽어도 아무도 사랑하지 않았던 고양이가, 처음으로 진짜 사랑을 만나 단 한 번뿐인 삶의 의미를 깨닫는 깊고 아름다운 이야기입니다.",
  "readAloud": "마지막 장면에서 책을 잠깐 덮고 \"이 고양이는 왜 울었을까?\" 아이와 이야기 나눠 보세요.",
  "cover": {
   "emoji": "🐱",
   "palette": [
    "#1a1a2e",
    "#f5f0e8"
   ]
  },
  "quality": 0.97,
  "source": "curated"
 },
 {
  "id": "ko-하지만-하지만-할머니-4798",
  "lang": "ko",
  "title": "하지만 하지만 할머니",
  "author": "사노 요코",
  "publisher": "상상스쿨",
  "ages": [
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "가족",
   "감정",
   "일상",
   "동물"
  ],
  "mood": [
   "따뜻한",
   "웃긴"
  ],
  "blurb": "무엇이든 \"하지만 하지만\"으로 시작하며 못 한다고 말하던 할머니가 손녀 덕분에 하나씩 도전해 나가는 유쾌하고 따뜻한 이야기예요.",
  "readAloud": "할머니의 \"하지만 하지만~\" 대사를 아이와 함께 목소리를 흉내 내며 번갈아 읽어 보세요!",
  "cover": {
   "emoji": "👵",
   "palette": [
    "#F4A460",
    "#87CEEB"
   ]
  },
  "quality": 0.9,
  "source": "curated"
 },
 {
  "id": "ko-100층짜리-집-557d",
  "lang": "ko",
  "title": "100층짜리 집",
  "author": "이와이 도시오",
  "publisher": "북뱅크",
  "ages": [
   "3-4",
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "동물",
   "환상",
   "모험",
   "일상"
  ],
  "mood": [
   "모험",
   "따뜻한"
  ],
  "blurb": "100층이나 되는 집을 한 층 한 층 올라가며 다양한 동물 이웃을 만나는 설레는 탐험 그림책으로, 아이들의 상상력과 호기심을 층층이 자극합니다.",
  "readAloud": "\"몇 층일까, 누가 살까?\" 하며 다음 페이지를 넘기기 전에 아이가 먼저 예측해 보게 해 주세요!",
  "cover": {
   "emoji": "🏠",
   "palette": [
    "#5BAD6F",
    "#F9E04B"
   ]
  },
  "quality": 0.88,
  "source": "curated"
 },
 {
  "id": "ko-지하-100층짜리-집-42ac",
  "lang": "ko",
  "title": "지하 100층짜리 집",
  "author": "이와이 도시오",
  "publisher": "북뱅크",
  "ages": [
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "환상",
   "모험",
   "동물",
   "일상"
  ],
  "mood": [
   "모험",
   "웃긴"
  ],
  "blurb": "두더지가 사는 신비로운 지하 100층짜리 집! 층층마다 다양한 동물 이웃들이 살고 있어, 아이들이 숫자와 함께 흥미진진한 탐험을 즐길 수 있어요.",
  "readAloud": "각 층의 숫자를 함께 세면서 \"다음 층엔 누가 살까?\" 하고 아이에게 먼저 물어보세요!",
  "cover": {
   "emoji": "🏚️",
   "palette": [
    "#5B3A29",
    "#A8D5A2"
   ]
  },
  "quality": 0.88,
  "source": "curated"
 },
 {
  "id": "ko-바다-100층짜리-집-65ec",
  "lang": "ko",
  "title": "바다 100층짜리 집",
  "author": "이와이 도시오",
  "publisher": "북뱅크",
  "ages": [
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "동물",
   "자연",
   "모험",
   "환상"
  ],
  "mood": [
   "모험",
   "학습"
  ],
  "blurb": "바닷속 100층을 한 층 한 층 내려가며 만나는 신기한 바다 생물들! 깊은 바다의 세계를 유쾌하게 탐험하는 시리즈 그림책입니다.",
  "readAloud": "각 층마다 어떤 동물이 나올지 아이가 먼저 예상해 보게 하고, 동물 이름과 특징을 함께 이야기해 보세요.",
  "cover": {
   "emoji": "🌊",
   "palette": [
    "#0077B6",
    "#90E0EF"
   ]
  },
  "quality": 0.85,
  "source": "curated"
 },
 {
  "id": "ko-이게-정말-사과일까-68cf",
  "lang": "ko",
  "title": "이게 정말 사과일까?",
  "author": "요시타케 신스케",
  "publisher": "주니어김영사",
  "ages": [
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "환상",
   "음식",
   "유머",
   "감정"
  ],
  "mood": [
   "웃긴",
   "잔잔한"
  ],
  "blurb": "빨간 사과 하나를 보며 \"이게 정말 사과일까?\" 하고 끝없이 상상을 펼치는 그림책으로, 아이의 엉뚱하고 자유로운 사고방식을 유쾌하게 담아냈습니다. 요시타케 신스케 특유의 발랄한 그림과 톡톡 튀는 아이디어가 상상력을 무한히 자극합니다.",
  "readAloud": "\"이게 정말 사과일까?\" 하고 아이에게 질문을 던진 뒤, 아이만의 엉뚱한 대답을 함께 나눠 보세요!",
  "cover": {
   "emoji": "🍎",
   "palette": [
    "#E8251F",
    "#F5F0E8"
   ]
  },
  "quality": 0.92,
  "source": "curated"
 },
 {
  "id": "ko-이게-정말-나일까-ed27",
  "lang": "ko",
  "title": "이게 정말 나일까?",
  "author": "요시타케 신스케",
  "publisher": "주니어김영사",
  "ages": [
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "감정",
   "일상",
   "유머",
   "환상"
  ],
  "mood": [
   "웃긴",
   "따뜻한"
  ],
  "blurb": "거울 속 내 모습이 영 낯설게 느껴지는 아이가 \"나는 정말 나일까?\"라고 엉뚱하면서도 진지하게 고민하는 이야기로, 자기 자신을 탐구하는 즐거움을 전합니다.",
  "readAloud": "\"너는 네가 나라고 생각해?\" 하고 아이에게 질문을 던지며 함께 상상의 나래를 펼쳐 보세요.",
  "cover": {
   "emoji": "🪞",
   "palette": [
    "#F4C542",
    "#A8D8EA"
   ]
  },
  "quality": 0.88,
  "source": "curated"
 },
 {
  "id": "ko-벗지-말걸-그랬어-6462",
  "lang": "ko",
  "title": "벗지 말걸 그랬어",
  "author": "요시타케 신스케",
  "publisher": "스콜라",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "유머",
   "일상",
   "감정"
  ],
  "mood": [
   "웃긴",
   "따뜻한"
  ],
  "blurb": "옷 벗기가 싫어서 온갖 이유를 늘어놓는 아이의 기발하고 엉뚱한 상상력이 폭발하는 그림책으로, 읽는 내내 웃음이 터집니다.",
  "readAloud": "아이가 직접 \"내가 벗기 싫은 이유\"를 말하게 해보세요—상상력이 쑥쑥 자라납니다!",
  "cover": {
   "emoji": "👕",
   "palette": [
    "#F9E04B",
    "#F4A261"
   ]
  },
  "quality": 0.88,
  "source": "curated"
 },
 {
  "id": "ko-내가-라면을-먹을-때-8f94",
  "lang": "ko",
  "title": "내가 라면을 먹을 때",
  "author": "하세가와 요시후미",
  "publisher": "고래이야기",
  "ages": [
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "음식",
   "일상",
   "가족",
   "감정"
  ],
  "mood": [
   "잔잔한",
   "따뜻한"
  ],
  "blurb": "내가 따뜻한 라면 한 그릇을 먹는 그 순간, 지구 반대편에서는 어떤 일이 벌어지고 있을까요? 일상의 작은 식사가 세상과 어떻게 연결되어 있는지를 조용하지만 깊이 있게 보여 주는 그림책입니다.",
  "readAloud": "책을 다 읽고 \"지금 이 순간 다른 나라 친구들은 뭘 하고 있을까?\" 하고 아이와 함께 상상해 보세요.",
  "cover": {
   "emoji": "🍜",
   "palette": [
    "#E8603C",
    "#4A90D9"
   ]
  },
  "quality": 0.91,
  "source": "curated"
 },
 {
  "id": "ko-도토리-마을의-모자-가게-c75f",
  "lang": "ko",
  "title": "도토리 마을의 모자 가게",
  "author": "나카야 미와",
  "publisher": "웅진주니어",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "동물",
   "일상",
   "친구",
   "환상"
  ],
  "mood": [
   "따뜻한",
   "잔잔한"
  ],
  "blurb": "도토리 마을의 다람쥐 모자 가게에서 동물 손님들이 저마다 딱 맞는 모자를 찾아가는 따스한 이야기로, 각자의 개성과 소중함을 자연스럽게 느낄 수 있어요.",
  "readAloud": "각 동물이 어떤 모자를 고를지 아이와 함께 먼저 상상해 보며 읽으면 더욱 즐거워요!",
  "cover": {
   "emoji": "🎩",
   "palette": [
    "#A0522D",
    "#F5DEB3"
   ]
  },
  "quality": 0.82,
  "source": "curated"
 },
 {
  "id": "ko-쇠를-먹는-불가사리-4375",
  "lang": "ko",
  "title": "쇠를 먹는 불가사리",
  "author": "정하섭",
  "publisher": "길벗어린이",
  "ages": [
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "환상",
   "모험",
   "동물",
   "감정"
  ],
  "mood": [
   "따뜻한",
   "모험"
  ],
  "blurb": "쇠를 먹고 자라는 신비로운 생물 불가사리가 등장하는 우리나라 전래 이야기로, 억압받는 백성들의 소망과 용기를 담은 판타지 그림책입니다.",
  "readAloud": "불가사리가 점점 커지는 장면에서 목소리를 높여 긴장감을 살려 읽어 주세요!",
  "cover": {
   "emoji": "🦕",
   "palette": [
    "#2E4A7A",
    "#C8392B"
   ]
  },
  "quality": 0.78,
  "source": "curated"
 },
 {
  "id": "ko-엄마가-알을-낳았대-63e3",
  "lang": "ko",
  "title": "엄마가 알을 낳았대!",
  "author": "배빗 콜",
  "publisher": "보림",
  "ages": [
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "가족",
   "일상",
   "유머",
   "감정"
  ],
  "mood": [
   "웃긴",
   "따뜻한"
  ],
  "blurb": "아기는 어디서 왔을까요? 엄마 아빠가 들려주는 엉뚱한 설명과 아이가 밝히는 진실이 유쾌하게 충돌하며, 성교육을 자연스럽고 유머러스하게 풀어낸 그림책입니다.",
  "readAloud": "아이가 직접 부모 캐릭터 목소리를 흉내 내며 읽어 보게 하면 더욱 신나는 책읽기가 됩니다.",
  "cover": {
   "emoji": "🥚",
   "palette": [
    "#F9E04B",
    "#F4A7B9"
   ]
  },
  "quality": 0.88,
  "source": "curated"
 },
 {
  "id": "ko-장갑-210d",
  "lang": "ko",
  "title": "장갑",
  "author": "에우게니 M. 라초프",
  "publisher": "한림출판사",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "동물",
   "환상",
   "자연",
   "가족"
  ],
  "mood": [
   "따뜻한",
   "웃긴"
  ],
  "blurb": "눈 속에 떨어진 낡은 장갑 하나에 동물들이 하나둘 모여드는 이야기로, 작은 것도 나누면 넉넉해진다는 따뜻한 메시지를 전합니다.",
  "readAloud": "동물이 들어올 때마다 \"나도 껴도 돼요?\" 대사를 아이와 함께 따라 읽으며 다음에 올 동물을 맞혀 보세요!",
  "cover": {
   "emoji": "🧤",
   "palette": [
    "#B5C8E2",
    "#F5ECD7"
   ]
  },
  "quality": 0.93,
  "source": "curated"
 },
 {
  "id": "ko-야쿠바와-사자-9cc9",
  "lang": "ko",
  "title": "야쿠바와 사자",
  "author": "티에리 드되",
  "publisher": "길벗어린이",
  "ages": [
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "모험",
   "동물",
   "감정",
   "가족"
  ],
  "mood": [
   "따뜻한",
   "모험"
  ],
  "blurb": "어른이 되기 위한 시험에서 사자를 만난 소년 야쿠바—창을 들었지만 그의 선택은 용기와 진정한 용사의 의미를 되묻는다.",
  "readAloud": "\"야쿠바라면 어떻게 했을 것 같아?\" 읽고 나서 아이와 용기의 진짜 뜻을 함께 이야기해 보세요.",
  "cover": {
   "emoji": "🦁",
   "palette": [
    "#C2853A",
    "#2B4A1E"
   ]
  },
  "quality": 0.88,
  "source": "curated"
 },
 {
  "id": "ko-행복한-청소부-eb27",
  "lang": "ko",
  "title": "행복한 청소부",
  "author": "모니카 페트",
  "publisher": "풀빛",
  "ages": [
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "일상",
   "감정",
   "친구"
  ],
  "mood": [
   "따뜻한",
   "잔잔한"
  ],
  "blurb": "거리의 청소부 아저씨가 매일 행복하게 일하는 비결—노래와 시, 그리고 작은 것들에서 기쁨을 찾는 마음을 가르쳐 주는 따뜻한 이야기입니다.",
  "readAloud": "청소부 아저씨가 노래하는 장면에서 함께 흥얼거리며 \"나는 어떤 일을 할 때 가장 행복해?\" 하고 물어보세요.",
  "cover": {
   "emoji": "🧹",
   "palette": [
    "#F5C842",
    "#4A90D9"
   ]
  },
  "quality": 0.9,
  "source": "curated"
 },
 {
  "id": "ko-아낌없이-주는-나무-5687",
  "lang": "ko",
  "title": "아낌없이 주는 나무",
  "author": "쉘 실버스타인",
  "publisher": "시공주니어",
  "ages": [
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "가족",
   "자연",
   "감정",
   "친구"
  ],
  "mood": [
   "따뜻한",
   "잔잔한"
  ],
  "blurb": "나무는 소년이 원하는 것을 모두 내어주면서도 언제나 행복합니다. 아낌없이 베푸는 사랑의 의미를 잔잔하고 깊게 전해 주는 시대를 초월한 고전입니다.",
  "readAloud": "나무와 소년의 대화를 각각 다른 목소리로 읽어 주면 아이가 감정이입을 더 깊이 할 수 있어요.",
  "cover": {
   "emoji": "🌳",
   "palette": [
    "#4a7c59",
    "#f5e6c8"
   ]
  },
  "quality": 0.98,
  "source": "curated"
 },
 {
  "id": "ko-어디로-갔을까-나의-한쪽은-133d",
  "lang": "ko",
  "title": "어디로 갔을까 나의 한쪽은",
  "author": "쉘 실버스타인",
  "publisher": "시공주니어",
  "ages": [
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "감정",
   "모험",
   "친구",
   "일상"
  ],
  "mood": [
   "잔잔한",
   "따뜻한"
  ],
  "blurb": "빠진 한 조각을 찾아 굴러다니는 동그라미 이야기로, '나를 완성시켜 줄 무언가'를 찾는 여정을 통해 진정한 행복과 자아 수용의 의미를 담담하게 전합니다. 단순하고 여백 많은 그림 속에 깊은 철학적 울림이 담긴 그림책입니다.",
  "readAloud": "\"너의 빠진 한 조각은 뭐라고 생각해?\" 하고 읽고 난 뒤 아이와 함께 이야기 나눠 보세요.",
  "cover": {
   "emoji": "🔵",
   "palette": [
    "#FFFFFF",
    "#1A1A1A"
   ]
  },
  "quality": 0.95,
  "source": "curated"
 },
 {
  "id": "ko-안녕-나의-등대-f548",
  "lang": "ko",
  "title": "안녕, 나의 등대",
  "author": "소피 블래콜",
  "publisher": "비룡소",
  "ages": [
   "3-4",
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "가족",
   "감정",
   "자연",
   "일상"
  ],
  "mood": [
   "따뜻한",
   "잔잔한"
  ],
  "blurb": "바다 위 등대에 사는 아이와 등대지기 아빠의 따뜻한 이별과 기다림을 섬세한 그림으로 담아낸 작품으로, 사랑하는 사람을 그리워하는 마음을 잔잔하게 전해줍니다.",
  "readAloud": "\"아빠(엄마)가 멀리 가 있을 때 어떤 기분이었어?\" 하고 물어보며 함께 이야기 나눠 보세요.",
  "cover": {
   "emoji": "🏮",
   "palette": [
    "#1B3A5C",
    "#F5E6C8"
   ]
  },
  "quality": 0.88,
  "source": "curated"
 },
 {
  "id": "ko-와작와작-꿀꺽-책-먹는-아이-2c8d",
  "lang": "ko",
  "title": "와작와작 꿀꺽 책 먹는 아이",
  "author": "올리버 제퍼스",
  "publisher": "주니어김영사",
  "ages": [
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "유머",
   "일상",
   "감정"
  ],
  "mood": [
   "웃긴",
   "따뜻한"
  ],
  "blurb": "책을 진짜로 먹어치우며 지식을 얻으려는 엉뚱한 소년의 이야기로, 읽기의 진짜 즐거움을 유쾌하게 일깨워 줍니다.",
  "readAloud": "아이와 함께 \"와작와작 꿀꺽\" 소리를 크게 내며 읽으면 더욱 신나요!",
  "cover": {
   "emoji": "📚",
   "palette": [
    "#E8412A",
    "#F5E6C8"
   ]
  },
  "quality": 0.88,
  "source": "curated"
 },
 {
  "id": "ko-크레용이-화났어-10d9",
  "lang": "ko",
  "title": "크레용이 화났어!",
  "author": "드루 데이월트",
  "publisher": "위즈덤하우스",
  "ages": [
   "3-4",
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "감정",
   "그림그리기",
   "유머",
   "일상"
  ],
  "mood": [
   "웃긴",
   "따뜻한"
  ],
  "blurb": "크레용들이 주인 Duncan에게 편지를 써서 자신의 불만을 터놓는다는 기발한 설정으로, 색깔마다 다른 감정과 개성을 유머러스하게 담아낸 그림책입니다. 아이들이 색깔과 감정을 동시에 배울 수 있어요!",
  "readAloud": "각 크레용의 편지를 읽을 때 해당 색 크레용을 손에 쥐고 목소리를 바꿔가며 읽어주면 훨씬 생생하게 즐길 수 있어요!",
  "cover": {
   "emoji": "🖍️",
   "palette": [
    "#E8412A",
    "#F5C842"
   ]
  },
  "quality": 0.95,
  "source": "curated"
 },
 {
  "id": "ko-코를-킁킁-e6db",
  "lang": "ko",
  "title": "코를 킁킁",
  "author": "루스 크라우스",
  "publisher": "비룡소",
  "ages": [
   "0-2",
   "3-4"
  ],
  "level": "보드북",
  "themes": [
   "자연",
   "동물",
   "일상"
  ],
  "mood": [
   "따뜻한",
   "잔잔한"
  ],
  "blurb": "봄이 오면 땅속에서 무슨 일이 일어날까요? 씨앗들이 움트는 봄의 감각을 아이의 눈높이에서 따뜻하고 감성적으로 담아낸 그림책이에요.",
  "readAloud": "씨앗이 자라는 장면마다 아이와 함께 코를 킁킁 맡는 흉내를 내며 읽어 보세요!",
  "cover": {
   "emoji": "🌱",
   "palette": [
    "#7DBE6A",
    "#F5E6C8"
   ]
  },
  "quality": 0.88,
  "source": "curated"
 },
 {
  "id": "en-the-snowy-day-f75d",
  "lang": "en",
  "title": "The Snowy Day",
  "author": "Ezra Jack Keats",
  "publisher": "",
  "isbn": "9780670867332",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "일상",
   "자연",
   "감정"
  ],
  "mood": [
   "따뜻한",
   "잔잔한"
  ],
  "blurb": "눈 내린 날 아침, 꼬마 피터가 온 동네를 혼자 탐험하며 눈의 신비를 온몸으로 느끼는 이야기예요. 1963년 칼데콧 메달을 받은 그림책의 고전으로, 소박하지만 찬란한 어린 시절의 하루를 담았습니다.",
  "readAloud": "눈 밟는 소리를 \"뽀드득 뽀드득\" 함께 흉내 내며 읽어 보세요!",
  "cover": {
   "emoji": "❄️",
   "palette": [
    "#FFFFFF",
    "#E8F4FD"
   ]
  },
  "quality": 1,
  "source": "curated"
 },
 {
  "id": "en-whistle-for-willie-e35c",
  "lang": "en",
  "title": "Whistle for Willie",
  "author": "Ezra Jack Keats",
  "publisher": "",
  "isbn": "9780140502022",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "일상",
   "감정",
   "친구",
   "동물"
  ],
  "mood": [
   "따뜻한",
   "잔잔한"
  ],
  "blurb": "휘파람을 불고 싶은 꼬마 피터가 포기하지 않고 계속 도전하는 모습을 통해, 작은 성취의 기쁨과 뿌듯함을 따뜻하게 담아낸 그림책입니다.",
  "readAloud": "아이와 함께 실제로 휘파람 불기에 도전해 보며 읽으면 더욱 신나요!",
  "cover": {
   "emoji": "🐕",
   "palette": [
    "#F4C842",
    "#3B7ABF"
   ]
  },
  "quality": 0.93,
  "source": "curated"
 },
 {
  "id": "en-peter-s-chair-3cda",
  "lang": "en",
  "title": "Peter's Chair",
  "author": "Ezra Jack Keats",
  "publisher": "",
  "isbn": "9780140564419",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "가족",
   "감정",
   "일상"
  ],
  "mood": [
   "따뜻한",
   "잔잔한"
  ],
  "blurb": "새 아기 때문에 자기 의자마저 빼앗길 것 같아 속상한 피터가 진짜 가족의 사랑을 깨달아 가는 이야기예요.",
  "readAloud": "\"네 의자가 생겼을 때 기분이 어땠어?\" 하고 아이에게 물어보며 감정에 공감해 주세요.",
  "cover": {
   "emoji": "🪑",
   "palette": [
    "#E8C9A0",
    "#5B8DB8"
   ]
  },
  "quality": 0.93,
  "source": "curated"
 },
 {
  "id": "en-a-letter-to-amy-b08e",
  "lang": "en",
  "title": "A Letter to Amy",
  "author": "Ezra Jack Keats",
  "publisher": "",
  "ages": [
   "3-4",
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "친구",
   "일상",
   "감정"
  ],
  "mood": [
   "따뜻한",
   "잔잔한"
  ],
  "blurb": "피터는 친구 에이미에게 생일 파티 초대장을 직접 편지로 쓰고 싶어 빗속을 뛰어가지만, 뜻밖의 실수로 마음을 졸이게 됩니다. 소소한 일상 속에서 우정과 배려의 의미를 담백하게 전하는 따뜻한 이야기예요.",
  "readAloud": "편지를 쓰는 장면에서 잠깐 멈추고 \"너라면 친구한테 어떤 편지를 쓰고 싶어?\" 하고 아이에게 물어보세요.",
  "cover": {
   "emoji": "✉️",
   "palette": [
    "#4A7BB5",
    "#E8C97A"
   ]
  },
  "quality": 0.88,
  "source": "curated"
 },
 {
  "id": "en-goggles-43d5",
  "lang": "en",
  "title": "Goggles!",
  "author": "Ezra Jack Keats",
  "publisher": "",
  "ages": [
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "친구",
   "모험",
   "일상",
   "감정"
  ],
  "mood": [
   "모험",
   "따뜻한"
  ],
  "blurb": "피터와 아치가 발견한 멋진 오토바이 고글을 동네 형들에게 빼앗기지 않으려 머리를 맞대는 이야기로, 우정과 용기의 소중함을 따뜻하게 담아냈습니다.",
  "readAloud": "형들이 고글을 빼앗으러 올 때 아이에게 \"어떻게 하면 좋을까?\" 물으며 함께 이야기를 이끌어 보세요.",
  "cover": {
   "emoji": "🥽",
   "palette": [
    "#C0392B",
    "#F5CBA7"
   ]
  },
  "quality": 0.88,
  "source": "curated"
 },
 {
  "id": "en-make-way-for-ducklings-cc95",
  "lang": "en",
  "title": "Make Way for Ducklings",
  "author": "Robert McCloskey",
  "publisher": "",
  "isbn": "9780670451494",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "동물",
   "가족",
   "일상",
   "모험"
  ],
  "mood": [
   "따뜻한",
   "잔잔한"
  ],
  "blurb": "엄마 오리 말라드가 보스턴 도심 한복판에서 아기 오리 여덟 마리를 이끌고 안전한 공원까지 행진하는 따뜻하고 사랑스러운 이야기입니다. 가족의 사랑과 보금자리를 찾는 여정이 잔잔한 감동을 줍니다.",
  "readAloud": "아기 오리 이름(Jack, Kack, Lack…)을 함께 리듬감 있게 외쳐 보세요!",
  "cover": {
   "emoji": "🦆",
   "palette": [
    "#C8A96E",
    "#4A7C59"
   ]
  },
  "quality": 1,
  "source": "curated"
 },
 {
  "id": "en-blueberries-for-sal-3b21",
  "lang": "en",
  "title": "Blueberries for Sal",
  "author": "Robert McCloskey",
  "publisher": "",
  "isbn": "9780670175918",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "동물",
   "자연",
   "가족",
   "음식"
  ],
  "mood": [
   "따뜻한",
   "잔잔한"
  ],
  "blurb": "아기 샐과 아기 곰이 블루베리 언덕에서 엄마를 잃어버렸다가 서로 엄마를 바꿔 만나게 되는 유쾌하고 포근한 이야기예요. 사람과 자연이 나란히 살아가는 따뜻한 순간을 담백한 두 색 판화로 담아낸 1948년 칼데콧 아너 수상작입니다.",
  "readAloud": "\"쿵당, 쿵당, 쿵당!\" 블루베리 통에 떨어지는 소리를 아이와 함께 리듬감 있게 따라 읽어 보세요.",
  "cover": {
   "emoji": "🫐",
   "palette": [
    "#1B3A5C",
    "#F5ECD7"
   ]
  },
  "quality": 0.93,
  "source": "curated"
 },
 {
  "id": "en-the-polar-express-182c",
  "lang": "en",
  "title": "The Polar Express",
  "author": "Chris Van Allsburg",
  "publisher": "",
  "isbn": "9780395389492",
  "ages": [
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "환상",
   "모험",
   "가족",
   "일상"
  ],
  "mood": [
   "따뜻한",
   "잔잔한"
  ],
  "blurb": "크리스마스 이브 밤, 마법의 기차를 타고 북극으로 떠나는 소년의 경이로운 여정을 담은 그림책입니다. 산타클로스에게 받은 작은 선물이 전하는 믿음의 의미가 가슴 깊이 남습니다.",
  "readAloud": "기차 소리를 흉내 내며 읽어 주고, \"넌 어떤 선물을 받고 싶어?\" 하고 아이와 이야기 나눠 보세요.",
  "cover": {
   "emoji": "🚂",
   "palette": [
    "#1B3A6B",
    "#C8102E"
   ]
  },
  "quality": 1,
  "source": "curated"
 },
 {
  "id": "en-jumanji-8900",
  "lang": "en",
  "title": "Jumanji",
  "author": "Chris Van Allsburg",
  "publisher": "",
  "isbn": "9780395304488",
  "ages": [
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "모험",
   "환상",
   "동물",
   "유머"
  ],
  "mood": [
   "모험",
   "웃긴"
  ],
  "blurb": "지루하던 오후, 두 남매가 공원에서 발견한 보드게임 '주만지'를 시작하는 순간 집 안이 정글로 변해 버려요! 게임을 끝까지 완료해야만 원래 세상으로 돌아올 수 있는 긴장감 넘치는 모험이 펼쳐집니다.",
  "readAloud": "사자·원숭이·코뿔소 등 동물이 등장하는 장면마다 목소리를 바꿔 읽어 주면 아이가 훨씬 몰입해요!",
  "cover": {
   "emoji": "🎲",
   "palette": [
    "#2E5E2E",
    "#C8A951"
   ]
  },
  "quality": 0.97,
  "source": "curated"
 },
 {
  "id": "en-the-garden-of-abdul-gasazi-8483",
  "lang": "en",
  "title": "The Garden of Abdul Gasazi",
  "author": "Chris Van Allsburg",
  "publisher": "",
  "ages": [
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "환상",
   "동물",
   "모험",
   "감정"
  ],
  "mood": [
   "잔잔한",
   "모험"
  ],
  "blurb": "개를 쫓아 수상한 마법사의 금지된 정원에 들어간 소년 앨런—과연 개는 어디로 사라졌을까요? 크리스 반 알스버그 특유의 흑백 연필화가 현실과 꿈의 경계를 흐릿하게 만드는 수수께끼 같은 이야기입니다.",
  "readAloud": "마지막 장면을 함께 보며 \"정말 마법이었을까, 아니면 꿈이었을까?\" 아이와 이야기 나눠 보세요.",
  "cover": {
   "emoji": "🦆",
   "palette": [
    "#2E2E2E",
    "#A8B89C"
   ]
  },
  "quality": 0.92,
  "source": "curated"
 },
 {
  "id": "en-the-mysteries-of-harris-burdick-afd9",
  "lang": "en",
  "title": "The Mysteries of Harris Burdick",
  "author": "Chris Van Allsburg",
  "publisher": "",
  "isbn": "9780395353936",
  "ages": [
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "환상",
   "모험",
   "일상",
   "유머"
  ],
  "mood": [
   "잔잔한",
   "모험"
  ],
  "blurb": "수수께끼 같은 그림 14장과 단 한 줄의 캡션만으로 무한한 이야기를 상상하게 만드는, 세상에서 가장 신비로운 그림책입니다.",
  "readAloud": "각 그림을 보며 \"다음엔 어떤 일이 벌어질까?\" 아이 스스로 이야기를 지어보게 해주세요.",
  "cover": {
   "emoji": "🔍",
   "palette": [
    "#2B3A55",
    "#C8B89A"
   ]
  },
  "quality": 0.95,
  "source": "curated"
 },
 {
  "id": "en-the-wreck-of-the-zephyr-5e12",
  "lang": "en",
  "title": "The Wreck of the Zephyr",
  "author": "Chris Van Allsburg",
  "publisher": "",
  "ages": [
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "모험",
   "환상",
   "자연"
  ],
  "mood": [
   "잔잔한",
   "모험"
  ],
  "blurb": "어린 선원이 하늘을 나는 배의 비밀을 품은 채 폐선이 된 제퍼호의 이야기를 들려줍니다. 크리스 반 알스버그 특유의 신비롭고 몽환적인 그림이 바다와 하늘의 경계를 지워버립니다.",
  "readAloud": "파도 소리와 바람 소리를 흉내 내며 읽어 주면 이야기 속 신비로운 분위기가 더욱 살아납니다.",
  "cover": {
   "emoji": "⛵",
   "palette": [
    "#2E5D8E",
    "#C8A96E"
   ]
  },
  "quality": 0.88,
  "source": "curated"
 },
 {
  "id": "en-officer-buckle-and-gloria-3e0a",
  "lang": "en",
  "title": "Officer Buckle and Gloria",
  "author": "Peggy Rathmann",
  "publisher": "",
  "isbn": "9780399226168",
  "ages": [
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "친구",
   "일상",
   "유머",
   "동물"
  ],
  "mood": [
   "웃긴",
   "따뜻한"
  ],
  "blurb": "안전 규칙을 가르치는 경찰관 버클과 몰래 재롱을 피우는 경찰견 글로리아의 좌충우돌 우정 이야기로, 웃음 속에 '함께할 때 더 빛난다'는 진한 메시지를 전합니다.",
  "readAloud": "글로리아가 몰래 행동하는 장면마다 잠깐 멈추고 아이에게 \"글로리아가 지금 뭐 하고 있지?\" 하고 물어보세요!",
  "cover": {
   "emoji": "🐕",
   "palette": [
    "#1B3A6B",
    "#F5C842"
   ]
  },
  "quality": 0.97,
  "source": "curated"
 },
 {
  "id": "en-good-night-gorilla-5e7b",
  "lang": "en",
  "title": "Good Night, Gorilla",
  "author": "Peggy Rathmann",
  "publisher": "",
  "isbn": "9780399230035",
  "ages": [
   "0-2",
   "3-4",
   "5-6"
  ],
  "level": "보드북",
  "themes": [
   "동물",
   "잠자리",
   "유머",
   "일상"
  ],
  "mood": [
   "웃긴",
   "따뜻한"
  ],
  "blurb": "장난꾸러기 고릴라가 동물원 사육사 몰래 열쇠를 훔쳐 동물 친구들을 모두 풀어 주는 유쾌한 잠자리 그림책이에요. 거의 글 없이 그림만으로 이야기가 펼쳐져 아기부터 취학 전 아이까지 온 가족이 함께 웃을 수 있어요.",
  "readAloud": "각 동물 우리 앞에서 \"잘 자, ○○야!\" 하고 아이와 함께 동물 이름을 번갈아 외쳐 보세요.",
  "cover": {
   "emoji": "🦍",
   "palette": [
    "#7B3F8C",
    "#F4A823"
   ]
  },
  "quality": 0.97,
  "source": "curated"
 },
 {
  "id": "en-10-minutes-till-bedtime-208f",
  "lang": "en",
  "title": "10 Minutes till Bedtime",
  "author": "Peggy Rathmann",
  "publisher": "",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "잠자리",
   "동물",
   "유머",
   "일상"
  ],
  "mood": [
   "웃긴",
   "잔잔한"
  ],
  "blurb": "잠자리 10분 전, 햄스터 관광단이 우르르 집 안으로 몰려들어 온 집을 뒤집어 놓는 유쾌한 소동을 담은 그림책이에요. 숨은 햄스터를 찾아보는 재미 덕분에 아이들이 잠자리 가기를 오히려 기다리게 된답니다!",
  "readAloud": "카운트다운 숫자를 아이와 함께 큰 소리로 외치고, 각 장면에 숨어 있는 햄스터를 손가락으로 짚으며 세어 보세요.",
  "cover": {
   "emoji": "🐹",
   "palette": [
    "#F4A836",
    "#4A90D9"
   ]
  },
  "quality": 0.88,
  "source": "curated"
 },
 {
  "id": "en-sylvester-and-the-magic-pebble-c8fa",
  "lang": "en",
  "title": "Sylvester and the Magic Pebble",
  "author": "William Steig",
  "publisher": "",
  "isbn": "9780671662691",
  "ages": [
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "가족",
   "환상",
   "동물",
   "감정"
  ],
  "mood": [
   "따뜻한",
   "잔잔한"
  ],
  "blurb": "마법 조약돌을 발견한 당나귀 실베스터가 실수로 바위가 되어버리고, 가족의 사랑으로 다시 돌아오는 감동적인 이야기입니다.",
  "readAloud": "바위가 된 실베스터의 감정을 아이와 함께 이야기하며, \"너라면 어떤 소원을 빌었을까?\" 하고 물어보세요.",
  "cover": {
   "emoji": "🪨",
   "palette": [
    "#C0392B",
    "#F5CBA7"
   ]
  },
  "quality": 0.97,
  "source": "curated"
 },
 {
  "id": "en-brave-irene-a106",
  "lang": "en",
  "title": "Brave Irene",
  "author": "William Steig",
  "publisher": "",
  "isbn": "9780374309473",
  "ages": [
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "모험",
   "가족",
   "감정",
   "자연"
  ],
  "mood": [
   "따뜻한",
   "모험"
  ],
  "blurb": "눈보라 속을 혼자 헤쳐 나가는 어린 소녀 아이린의 용기와 사랑을 담은 이야기로, 어려움을 포기하지 않고 끝까지 나아가는 힘을 보여줍니다.",
  "readAloud": "눈보라 장면에서 바람 소리를 목소리로 흉내 내며 읽으면 아이가 아이린의 긴장감을 생생하게 느낄 수 있어요.",
  "cover": {
   "emoji": "🌨️",
   "palette": [
    "#4A6FA5",
    "#F5F0E8"
   ]
  },
  "quality": 0.92,
  "source": "curated"
 },
 {
  "id": "en-doctor-de-soto-4949",
  "lang": "en",
  "title": "Doctor De Soto",
  "author": "William Steig",
  "publisher": "",
  "isbn": "9780374318031",
  "ages": [
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "동물",
   "유머",
   "환상",
   "일상"
  ],
  "mood": [
   "웃긴",
   "따뜻한"
  ],
  "blurb": "생쥐 치과의사 드소토 선생님이 교활한 여우 환자를 지혜롭게 혼내주는 이야기로, 약자도 꾀와 용기로 위기를 헤쳐나갈 수 있다는 것을 유쾌하게 보여줍니다.",
  "readAloud": "여우와 드소토 선생님의 대화를 각각 다른 목소리로 연기하듯 읽어주면 아이가 더 신나게 즐길 수 있어요!",
  "cover": {
   "emoji": "🦷",
   "palette": [
    "#D9EAF7",
    "#F4A460"
   ]
  },
  "quality": 0.92,
  "source": "curated"
 },
 {
  "id": "en-amos-boris-9deb",
  "lang": "en",
  "title": "Amos & Boris",
  "author": "William Steig",
  "publisher": "",
  "isbn": "9780374302788",
  "ages": [
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "친구",
   "모험",
   "동물",
   "자연"
  ],
  "mood": [
   "따뜻한",
   "모험"
  ],
  "blurb": "바다를 사랑한 생쥐 에이모스와 거대한 고래 보리스가 맺은 우정 이야기로, 서로 전혀 다른 두 존재가 진심으로 돕고 아끼는 아름다운 관계를 보여줍니다.",
  "readAloud": "에이모스와 보리스가 작별하는 장면에서 잠시 멈추고 아이에게 \"왜 둘이 헤어져야 할까?\" 물어보세요.",
  "cover": {
   "emoji": "🐭🐋",
   "palette": [
    "#1B6CA8",
    "#F5E6C8"
   ]
  },
  "quality": 0.92,
  "source": "curated"
 },
 {
  "id": "en-pete-s-a-pizza-bd5e",
  "lang": "en",
  "title": "Pete's a Pizza",
  "author": "William Steig",
  "publisher": "",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "유머",
   "가족",
   "일상",
   "감정"
  ],
  "mood": [
   "웃긴",
   "따뜻한"
  ],
  "blurb": "비가 와서 울적한 피트를 아빠가 피자 반죽 삼아 주무르고 늘리며 웃음을 되찾아주는, 유쾌하고 사랑스러운 아빠표 놀이 그림책이에요.",
  "readAloud": "아이를 직접 무릎에 올려 피자 반죽 흉내를 내며 읽으면 깔깔대는 소리가 절로 나와요!",
  "cover": {
   "emoji": "🍕",
   "palette": [
    "#F4C842",
    "#D94F3D"
   ]
  },
  "quality": 0.9,
  "source": "curated"
 },
 {
  "id": "en-the-lion-the-mouse-5b02",
  "lang": "en",
  "title": "The Lion & the Mouse",
  "author": "Jerry Pinkney",
  "publisher": "",
  "isbn": "9780316013567",
  "ages": [
   "3-4",
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "동물",
   "자연",
   "모험",
   "감정"
  ],
  "mood": [
   "따뜻한",
   "잔잔한"
  ],
  "blurb": "말 한마디 없이 그림만으로 이야기를 전하는 이솝 우화 — 작은 생쥐가 거대한 사자를 구해내며 진정한 우정과 친절의 힘을 보여줍니다.",
  "readAloud": "그림 속 표정과 몸짓을 손으로 짚어가며 \"사자가 지금 어떤 기분일까?\" 하고 아이와 함께 이야기 나눠 보세요.",
  "cover": {
   "emoji": "🦁",
   "palette": [
    "#C8860A",
    "#4A7C3F"
   ]
  },
  "quality": 0.97,
  "source": "curated"
 },
 {
  "id": "en-owl-moon-cd48",
  "lang": "en",
  "title": "Owl Moon",
  "author": "Jane Yolen & John Schoenherr",
  "publisher": "",
  "isbn": "9780399214578",
  "ages": [
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "자연",
   "가족",
   "모험",
   "동물"
  ],
  "mood": [
   "잔잔한",
   "따뜻한"
  ],
  "blurb": "추운 겨울 밤, 아빠와 함께 올빼미를 찾아 숲속을 걷는 아이의 이야기로, 고요한 자연 속에서 피어나는 아버지와 딸의 따뜻한 교감을 담았습니다.",
  "readAloud": "책을 읽기 전 불을 살짝 낮추고, 낮고 조용한 목소리로 읽어 주면 겨울 밤 숲속의 분위기가 더욱 생생하게 살아납니다.",
  "cover": {
   "emoji": "🦉",
   "palette": [
    "#1B2A4A",
    "#F5ECD7"
   ]
  },
  "quality": 0.97,
  "source": "curated"
 },
 {
  "id": "en-a-sick-day-for-amos-mcgee-fdee",
  "lang": "en",
  "title": "A Sick Day for Amos McGee",
  "author": "Philip C. Stead & Erin E. Stead",
  "publisher": "",
  "isbn": "9781596434028",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "친구",
   "동물",
   "일상",
   "감정"
  ],
  "mood": [
   "따뜻한",
   "잔잔한"
  ],
  "blurb": "동물원 친구들을 매일 살뜰히 돌봐 온 에이모스 아저씨가 어느 날 몸이 아파 출근하지 못하자, 이번엔 동물 친구들이 직접 그를 찾아와 보살펴 주는 따뜻한 우정 이야기입니다.",
  "readAloud": "동물마다 에이모스가 해 주는 특별한 행동을 읽어 줄 때, 아이와 함께 \"우리도 이렇게 해 볼까?\" 하고 흉내 내어 보세요.",
  "cover": {
   "emoji": "🐘",
   "palette": [
    "#C8DDB0",
    "#F4A85D"
   ]
  },
  "quality": 0.97,
  "source": "curated"
 },
 {
  "id": "en-this-is-not-my-hat-dfc5",
  "lang": "en",
  "title": "This Is Not My Hat",
  "author": "Jon Klassen",
  "publisher": "",
  "isbn": "9781442435704",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "유머",
   "동물",
   "감정"
  ],
  "mood": [
   "웃긴",
   "잔잔한"
  ],
  "blurb": "작은 물고기가 큰 물고기의 모자를 몰래 훔쳐 달아나지만, 독자는 결말을 이미 알 것 같은 묘한 긴장감과 유머를 동시에 느끼게 됩니다. 칼데콧 메달 수상작으로, 단순하지만 강렬한 그림과 반전 있는 이야기가 오래도록 기억에 남는 걸작입니다.",
  "readAloud": "작은 물고기의 자신만만한 독백을 과장된 목소리로 읽어 주고, 마지막 장면에서는 잠시 멈춰 아이가 스스로 결말을 상상하도록 유도해 보세요!",
  "cover": {
   "emoji": "🐟",
   "palette": [
    "#1a3a5c",
    "#f5e6c8"
   ]
  },
  "quality": 0.97,
  "source": "curated"
 },
 {
  "id": "en-i-want-my-hat-back-7c2d",
  "lang": "en",
  "title": "I Want My Hat Back",
  "author": "Jon Klassen",
  "publisher": "",
  "isbn": "9781406338539",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "유머",
   "동물",
   "감정"
  ],
  "mood": [
   "웃긴",
   "잔잔한"
  ],
  "blurb": "곰이 잃어버린 모자를 찾아 여러 동물들에게 물어보는 단순한 이야기 속에, 결말에서 터지는 반전 유머가 압권인 그림책입니다.",
  "readAloud": "각 동물의 대사를 다른 목소리로 흉내 내며 읽어 주면 아이가 더 집중해요!",
  "cover": {
   "emoji": "🎩",
   "palette": [
    "#C0392B",
    "#D4B896"
   ]
  },
  "quality": 0.95,
  "source": "curated"
 },
 {
  "id": "en-we-found-a-hat-1509",
  "lang": "en",
  "title": "We Found a Hat",
  "author": "Jon Klassen",
  "publisher": "",
  "isbn": "9781536200737",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "친구",
   "감정",
   "동물",
   "일상"
  ],
  "mood": [
   "잔잔한",
   "따뜻한"
  ],
  "blurb": "거북이 두 마리가 모자 하나를 함께 발견하지만, 모자는 하나뿐이에요. 갖고 싶은 마음과 친구를 배려하는 마음 사이에서 갈등하는 잔잔하고 따뜻한 이야기입니다.",
  "readAloud": "\"모자를 갖고 싶은 마음이 들 때 어떻게 해야 할까?\" 아이와 함께 이야기 나눠 보세요.",
  "cover": {
   "emoji": "🎩",
   "palette": [
    "#D4873B",
    "#4A6FA5"
   ]
  },
  "quality": 0.93,
  "source": "curated"
 },
 {
  "id": "en-sam-and-dave-dig-a-hole-1b2c",
  "lang": "en",
  "title": "Sam and Dave Dig a Hole",
  "author": "Mac Barnett & Jon Klassen",
  "publisher": "",
  "isbn": "9781406357790",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "모험",
   "환상",
   "일상",
   "유머"
  ],
  "mood": [
   "잔잔한",
   "웃긴"
  ],
  "blurb": "샘과 데이브가 땅을 파고 또 파지만, 놀랍게도 보물을 번번이 비껴갑니다. 단순한 구덩이 파기가 어느새 기묘하고 매혹적인 여정이 됩니다.",
  "readAloud": "\"계속 파야 해!\"를 아이와 함께 반복하며 읽고, 마지막 장면에서 \"어, 이게 어디지?\" 하고 함께 首を傾けてみてください → 함께 갸우뚱해 보세요!",
  "cover": {
   "emoji": "⛏️",
   "palette": [
    "#C4A86B",
    "#4A7C59"
   ]
  },
  "quality": 0.95,
  "source": "curated"
 },
 {
  "id": "en-extra-yarn-44e1",
  "lang": "en",
  "title": "Extra Yarn",
  "author": "Mac Barnett & Jon Klassen",
  "publisher": "",
  "isbn": "9780061953385",
  "ages": [
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "환상",
   "일상",
   "친구",
   "동물"
  ],
  "mood": [
   "따뜻한",
   "잔잔한"
  ],
  "blurb": "회색빛 마을에 사는 소녀 아나벨이 절대 바닥나지 않는 털실 상자를 발견해 온 마을을 알록달록하게 물들이는 이야기로, 나눔과 따뜻함의 마법을 잔잔하게 전해줍니다.",
  "readAloud": "털실이 이어지는 장면마다 \"다음엔 누구한테 줄까?\" 하고 아이와 함께 상상해 보세요!",
  "cover": {
   "emoji": "🧶",
   "palette": [
    "#4A90D9",
    "#E8D5B7"
   ]
  },
  "quality": 0.92,
  "source": "curated"
 },
 {
  "id": "en-the-adventures-of-beekle-the-uni-b5f2",
  "lang": "en",
  "title": "The Adventures of Beekle: The Unimaginary Friend",
  "author": "Dan Santat",
  "publisher": "",
  "isbn": "9780316199988",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "친구",
   "환상",
   "감정",
   "모험"
  ],
  "mood": [
   "따뜻한",
   "모험"
  ],
  "blurb": "상상 속 친구 비클은 자신을 불러줄 아이를 찾아 먼 여행을 떠납니다. 나만의 특별한 친구를 기다리는 설레임과 진정한 우정의 시작을 담은 감동적인 이야기예요.",
  "readAloud": "\"네가 상상하는 친구는 어떤 모습일까?\" 하고 물어보며 아이와 함께 비클을 그려보세요.",
  "cover": {
   "emoji": "🌟",
   "palette": [
    "#F5E6CA",
    "#5B8DB8"
   ]
  },
  "quality": 0.97,
  "source": "curated"
 },
 {
  "id": "en-locomotive-e228",
  "lang": "en",
  "title": "Locomotive",
  "author": "Brian Floca",
  "publisher": "",
  "isbn": "9781416994152",
  "ages": [
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "탈것",
   "모험",
   "자연",
   "일상"
  ],
  "mood": [
   "학습",
   "모험"
  ],
  "blurb": "1869년 완공된 미국 대륙횡단철도를 배경으로, 증기기관차를 타고 광활한 땅을 가로지르는 한 가족의 여정을 박진감 넘치는 그림과 함께 담아냈습니다. 기관차의 구조와 작동 원리까지 생생하게 배울 수 있어요!",
  "readAloud": "\"칙칙폭폭\" 소리를 함께 내며 읽으면 기차의 속도감을 온몸으로 느낄 수 있어요.",
  "cover": {
   "emoji": "🚂",
   "palette": [
    "#2B3A6B",
    "#C0392B"
   ]
  },
  "quality": 0.97,
  "source": "curated"
 },
 {
  "id": "en-flotsam-7e7d",
  "lang": "en",
  "title": "Flotsam",
  "author": "David Wiesner",
  "publisher": "",
  "isbn": "9780618194575",
  "ages": [
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "환상",
   "모험",
   "자연",
   "일상"
  ],
  "mood": [
   "잔잔한",
   "모험"
  ],
  "blurb": "바닷가에서 주운 낡은 카메라 속에 담긴 사진들—수중 세계의 경이로운 환상이 글 한 줄 없이 펼쳐지는 칼데콧 수상작입니다.",
  "readAloud": "페이지마다 숨은 디테일을 함께 찾아보며 \"이 다음엔 어떤 사진이 나올까?\" 하고 아이와 상상을 나눠 보세요.",
  "cover": {
   "emoji": "📷",
   "palette": [
    "#1A6B9A",
    "#F4C842"
   ]
  },
  "quality": 0.97,
  "source": "curated"
 },
 {
  "id": "en-tuesday-5847",
  "lang": "en",
  "title": "Tuesday",
  "author": "David Wiesner",
  "publisher": "",
  "isbn": "9780395551134",
  "ages": [
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "환상",
   "동물",
   "모험",
   "유머"
  ],
  "mood": [
   "웃긴",
   "모험"
  ],
  "blurb": "어느 화요일 밤, 개구리들이 연잎을 타고 하늘을 날아다니며 마을을 누빈다는 기발하고 유머러스한 이야기로, 거의 글 없이 그림만으로 이야기가 펼쳐지는 독창적인 그림책입니다.",
  "readAloud": "\"다음엔 무슨 일이 일어날까?\" 하고 다음 장을 넘기기 전에 아이에게 먼저 상상해 보게 하세요.",
  "cover": {
   "emoji": "🐸",
   "palette": [
    "#4A90D9",
    "#7EC850"
   ]
  },
  "quality": 1,
  "source": "curated"
 },
 {
  "id": "en-the-three-pigs-4972",
  "lang": "en",
  "title": "The Three Pigs",
  "author": "David Wiesner",
  "publisher": "",
  "isbn": "9780618007011",
  "ages": [
   "3-4",
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "환상",
   "동물",
   "모험",
   "유머"
  ],
  "mood": [
   "웃긴",
   "모험"
  ],
  "blurb": "늑대가 집을 날려버리자 돼지들이 이야기 밖으로 탈출해 다른 동화 속을 종횡무진 누비는 기발하고 유쾌한 메타픽션 그림책입니다.",
  "readAloud": "늑대가 '후~' 부는 장면에서 아이와 함께 크게 불어보고, 돼지들이 책 페이지를 접어 종이비행기로 만드는 장면에서 \"우리도 날아가 볼까?\" 하고 물어보세요!",
  "cover": {
   "emoji": "🐷",
   "palette": [
    "#F4A460",
    "#87CEEB"
   ]
  },
  "quality": 0.97,
  "source": "curated"
 },
 {
  "id": "en-kitten-s-first-full-moon-5072",
  "lang": "en",
  "title": "Kitten's First Full Moon",
  "author": "Kevin Henkes",
  "publisher": "",
  "isbn": "9780060588281",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "동물",
   "잠자리",
   "환상",
   "자연"
  ],
  "mood": [
   "잔잔한",
   "따뜻한"
  ],
  "blurb": "처음 보름달을 본 아기 고양이가 달을 우유 그릇으로 착각하고 잡으러 떠나는, 사랑스럽고 포근한 이야기입니다.",
  "readAloud": "아이와 함께 아기 고양이의 표정을 따라 해보며 읽으면 더욱 즐거워요!",
  "cover": {
   "emoji": "🌕",
   "palette": [
    "#F5F0E1",
    "#2C2C2C"
   ]
  },
  "quality": 0.97,
  "source": "curated"
 },
 {
  "id": "en-chrysanthemum-9237",
  "lang": "en",
  "title": "Chrysanthemum",
  "author": "Kevin Henkes",
  "publisher": "",
  "isbn": "9780688096991",
  "ages": [
   "3-4",
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "감정",
   "친구",
   "일상",
   "유머"
  ],
  "mood": [
   "따뜻한",
   "웃긴"
  ],
  "blurb": "자기 이름을 세상에서 가장 사랑했던 국화(Chrysanthemum)가 친구들의 놀림에 상처받고, 결국 자신의 특별함을 다시 찾아가는 따뜻하고 용기 있는 이야기예요.",
  "readAloud": "아이의 이름이 가진 의미나 유래를 함께 이야기 나눠 보세요 — \"네 이름은 왜 지었을까?\" 한 마디가 깊은 대화로 이어져요.",
  "cover": {
   "emoji": "🌸",
   "palette": [
    "#F4A7B9",
    "#7DBB8A"
   ]
  },
  "quality": 0.93,
  "source": "curated"
 },
 {
  "id": "en-lilly-s-purple-plastic-purse-015e",
  "lang": "en",
  "title": "Lilly's Purple Plastic Purse",
  "author": "Kevin Henkes",
  "publisher": "",
  "isbn": "9780688128975",
  "ages": [
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "감정",
   "일상",
   "친구",
   "유머"
  ],
  "mood": [
   "웃긴",
   "따뜻한"
  ],
  "blurb": "학교와 선생님을 너무나 사랑하는 생쥐 릴리가 보라색 지갑 때문에 벌어지는 소동을 통해 화가 났다가 화해하는 과정을 유쾌하게 담았어요.",
  "readAloud": "릴리가 화가 났을 때 감정을 어떻게 표현했는지 아이와 이야기 나눠 보세요.",
  "cover": {
   "emoji": "👜",
   "palette": [
    "#7B2D8B",
    "#F9E04B"
   ]
  },
  "quality": 0.93,
  "source": "curated"
 },
 {
  "id": "en-owen-64cf",
  "lang": "en",
  "title": "Owen",
  "author": "Kevin Henkes",
  "publisher": "",
  "isbn": "9780688114503",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "감정",
   "가족",
   "일상",
   "동물"
  ],
  "mood": [
   "따뜻한",
   "웃긴"
  ],
  "blurb": "오웬은 낡은 노란 담요 '퍼지'를 절대 놓지 못하는 생쥐 아이 — 학교에 들어가기 전에 담요와 헤어져야 할까요? 엄마의 사랑스러운 해결책이 마음을 따뜻하게 합니다.",
  "readAloud": "아이가 가장 아끼는 물건(인형, 담요 등)을 함께 떠올리며 \"네 '퍼지'는 뭐야?\" 하고 물어보세요.",
  "cover": {
   "emoji": "🧸",
   "palette": [
    "#F5C842",
    "#FFFFFF"
   ]
  },
  "quality": 0.93,
  "source": "curated"
 },
 {
  "id": "en-wemberly-worried-20e4",
  "lang": "en",
  "title": "Wemberly Worried",
  "author": "Kevin Henkes",
  "publisher": "",
  "isbn": "9780688170271",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "감정",
   "친구",
   "일상"
  ],
  "mood": [
   "따뜻한",
   "잔잔한"
  ],
  "blurb": "걱정이 너무 많은 생쥐 웸벌리가 유치원 첫날을 앞두고 온갖 걱정에 휩싸이지만, 비슷한 친구를 만나며 용기를 얻는 이야기입니다.",
  "readAloud": "아이가 평소에 걱정하는 것들을 함께 이야기 나눠 보세요 — \"너는 어떤 게 걱정돼?\" 라고 물어보면 좋아요.",
  "cover": {
   "emoji": "🐭",
   "palette": [
    "#f5c842",
    "#d9eaf7"
   ]
  },
  "quality": 0.88,
  "source": "curated"
 },
 {
  "id": "en-a-ball-for-daisy-fda7",
  "lang": "en",
  "title": "A Ball for Daisy",
  "author": "Chris Raschka",
  "publisher": "",
  "isbn": "9780375858611",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "동물",
   "감정",
   "일상",
   "친구"
  ],
  "mood": [
   "따뜻한",
   "잔잔한"
  ],
  "blurb": "강아지 데이지가 가장 아끼는 빨간 공을 잃어버리고 슬픔에 잠기지만, 새로운 친구의 작은 친절로 다시 행복을 되찾는 이야기예요.",
  "readAloud": "글이 없는 그림책이니 아이와 함께 그림을 보며 데이지의 표정과 감정을 직접 말로 표현해 보세요!",
  "cover": {
   "emoji": "🔴",
   "palette": [
    "#D72B2B",
    "#F5ECD7"
   ]
  },
  "quality": 0.95,
  "source": "curated"
 },
 {
  "id": "en-joseph-had-a-little-overcoat-9673",
  "lang": "en",
  "title": "Joseph Had a Little Overcoat",
  "author": "Simms Taback",
  "publisher": "",
  "isbn": "9780670878550",
  "ages": [
   "3-4",
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "일상",
   "가족",
   "유머",
   "환상"
  ],
  "mood": [
   "따뜻한",
   "웃긴"
  ],
  "blurb": "낡고 오래된 외투를 조금씩 잘라 조끼, 스카프, 단추로 만들어 가는 요셉 할아버지 이야기로, \"아무것도 없어도 뭔가를 만들 수 있다\"는 따뜻한 지혜를 전해 줍니다.",
  "readAloud": "각 페이지의 구멍(die-cut)을 손가락으로 짚으며 \"다음엔 뭐가 될까?\" 하고 아이와 함께 예측해 보세요!",
  "cover": {
   "emoji": "🧥",
   "palette": [
    "#C0392B",
    "#F5CBA7"
   ]
  },
  "quality": 0.97,
  "source": "curated"
 },
 {
  "id": "en-there-was-an-old-lady-who-swallo-96b6",
  "lang": "en",
  "title": "There Was an Old Lady Who Swallowed a Fly",
  "author": "Simms Taback",
  "publisher": "",
  "isbn": "9780670869398",
  "ages": [
   "3-4",
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "유머",
   "동물",
   "환상",
   "일상"
  ],
  "mood": [
   "웃긴",
   "따뜻한"
  ],
  "blurb": "파리를 꿀꺽 삼킨 할머니가 파리를 잡으려고 거미, 새, 고양이…점점 더 큰 동물을 계속 삼켜 가는 유쾌한 누적식 그림책입니다. Simms Taback의 알록달록한 콜라주 그림과 반복되는 노래 가사가 아이들의 웃음을 터뜨립니다.",
  "readAloud": "동물이 나올 때마다 아이와 함께 \"삼켰네, 삼켰네!\" 후렴을 크게 따라 부르며 읽어 보세요.",
  "cover": {
   "emoji": "🪰",
   "palette": [
    "#F4A300",
    "#6DBF67"
   ]
  },
  "quality": 0.92,
  "source": "curated"
 },
 {
  "id": "en-smoky-night-9bfb",
  "lang": "en",
  "title": "Smoky Night",
  "author": "Eve Bunting & David Diaz",
  "publisher": "",
  "ages": [
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "감정",
   "가족",
   "일상",
   "친구"
  ],
  "mood": [
   "따뜻한",
   "잔잔한"
  ],
  "blurb": "폭동이 일어난 밤, 불길과 혼란 속에서 한 소년이 이웃과 화해하고 함께하는 법을 배우는 감동적인 이야기입니다.",
  "readAloud": "그림 속 콜라주 배경을 손가락으로 짚으며 \"이 밤에 어떤 기분이 들어?\" 하고 함께 이야기 나눠 보세요.",
  "cover": {
   "emoji": "🔥",
   "palette": [
    "#1A1A2E",
    "#E07B39"
   ]
  },
  "quality": 0.95,
  "source": "curated"
 },
 {
  "id": "en-grandfather-s-journey-3c8d",
  "lang": "en",
  "title": "Grandfather's Journey",
  "author": "Allen Say",
  "publisher": "",
  "isbn": "9780395570357",
  "ages": [
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "가족",
   "모험",
   "자연",
   "일상"
  ],
  "mood": [
   "잔잔한",
   "따뜻한"
  ],
  "blurb": "일본과 미국 사이에서 두 나라 모두를 그리워했던 할아버지의 삶을 통해, 고향과 사랑하는 사람에 대한 그리움이 얼마나 깊고 아름다운 감정인지 조용히 전해줍니다.",
  "readAloud": "각 장면의 수채화 그림을 충분히 감상하며 천천히 읽어 주세요. 읽은 후 \"네가 가장 가고 싶은 곳은 어디야?\"라고 물어보면 좋아요.",
  "cover": {
   "emoji": "🚢",
   "palette": [
    "#C8A97A",
    "#4A7FA5"
   ]
  },
  "quality": 1,
  "source": "curated"
 },
 {
  "id": "en-tar-beach-83e6",
  "lang": "en",
  "title": "Tar Beach",
  "author": "Faith Ringgold",
  "publisher": "",
  "isbn": "9780517580301",
  "ages": [
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "환상",
   "가족",
   "모험",
   "일상"
  ],
  "mood": [
   "따뜻한",
   "모험"
  ],
  "blurb": "할렘의 옥상(타르 비치)에서 별빛 아래 누운 소녀 카시가 꿈속에서 도시 위를 자유롭게 날아오르며 가족을 위한 더 나은 세상을 꿈꾸는 이야기로, Faith Ringgold의 퀼트 아트가 그대로 살아 숨 쉬는 아름다운 그림책입니다.",
  "readAloud": "책을 읽으며 \"네가 하늘을 날 수 있다면 어디로 가고 싶어?\" 라고 아이에게 물어보세요.",
  "cover": {
   "emoji": "🌃",
   "palette": [
    "#1B2A4A",
    "#F5C842"
   ]
  },
  "quality": 0.92,
  "source": "curated"
 },
 {
  "id": "en-lon-po-po-1acf",
  "lang": "en",
  "title": "Lon Po Po",
  "author": "Ed Young",
  "publisher": "",
  "isbn": "9780399216190",
  "ages": [
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "환상",
   "동물",
   "가족",
   "모험"
  ],
  "mood": [
   "모험",
   "따뜻한"
  ],
  "blurb": "중국 전래동화를 바탕으로 한 빨간 모자 이야기로, 늑대로 변장한 '롱 포 포(할머니)'에 맞서 세 자매가 지혜와 용기로 위기를 헤쳐 나가는 그림책입니다. 칼데콧 메달 수상작으로, 동양적인 수묵화풍 삽화가 깊은 인상을 남깁니다.",
  "readAloud": "늑대의 목소리와 아이들의 목소리를 달리 연기하며 읽어주면 긴장감과 재미가 두 배!",
  "cover": {
   "emoji": "🐺",
   "palette": [
    "#2E4A1E",
    "#C8A96E"
   ]
  },
  "quality": 0.97,
  "source": "curated"
 },
 {
  "id": "en-why-mosquitoes-buzz-in-people-s--3240",
  "lang": "en",
  "title": "Why Mosquitoes Buzz in People's Ears",
  "author": "Verna Aardema & Leo and Diane Dillon",
  "publisher": "",
  "ages": [
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "동물",
   "환상",
   "자연",
   "유머"
  ],
  "mood": [
   "웃긴",
   "따뜻한"
  ],
  "blurb": "모기의 작은 거짓말 하나가 동물들 사이에 연쇄 소동을 일으키는 서아프리카 전래 이야기로, 1976년 칼데콧 메달을 수상한 아름다운 그림책입니다.",
  "readAloud": "각 동물이 등장할 때마다 흉내 내는 소리(의성어)를 아이와 함께 크게 따라 말해 보세요!",
  "cover": {
   "emoji": "🦟",
   "palette": [
    "#E8A838",
    "#2E6B3E"
   ]
  },
  "quality": 0.97,
  "source": "curated"
 },
 {
  "id": "en-madeline-s-rescue-889b",
  "lang": "en",
  "title": "Madeline's Rescue",
  "author": "Ludwig Bemelmans",
  "publisher": "",
  "isbn": "9780670446315",
  "ages": [
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "동물",
   "모험",
   "가족",
   "친구"
  ],
  "mood": [
   "따뜻한",
   "모험"
  ],
  "blurb": "용감한 소녀 마들린이 강에 빠졌다가 개에게 구조되면서 시작되는 따뜻한 우정 이야기로, 1954년 칼데콧 메달을 수상한 고전 그림책입니다.",
  "readAloud": "운율감 있는 영어 원문을 리듬에 맞춰 노래하듯 읽어 주면 아이가 훨씬 재미있어해요!",
  "cover": {
   "emoji": "🐕",
   "palette": [
    "#C8102E",
    "#F5E6C8"
   ]
  },
  "quality": 0.97,
  "source": "curated"
 },
 {
  "id": "en-madeline-d47e",
  "lang": "en",
  "title": "Madeline",
  "author": "Ludwig Bemelmans",
  "publisher": "",
  "isbn": "9780670445806",
  "ages": [
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "모험",
   "일상",
   "가족",
   "친구"
  ],
  "mood": [
   "따뜻한",
   "웃긴"
  ],
  "blurb": "파리의 기숙학교에 사는 작은 소녀 마들린은 겁이 없고 씩씩하게 온갖 모험을 헤쳐 나가요. 맹장 수술이라는 무서운 경험도 마들린에게는 신나는 이야기가 됩니다!",
  "readAloud": "운율감 있는 영어 문장이라 리듬을 살려 노래하듯 읽어 주면 아이들이 더 즐거워해요.",
  "cover": {
   "emoji": "👒",
   "palette": [
    "#F5C518",
    "#C0392B"
   ]
  },
  "quality": 0.97,
  "source": "curated"
 },
 {
  "id": "en-chicka-chicka-boom-boom-a96f",
  "lang": "en",
  "title": "Chicka Chicka Boom Boom",
  "author": "Bill Martin Jr. & John Archambault",
  "publisher": "",
  "isbn": "9780671679491",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "숫자/글자",
   "유머",
   "자연"
  ],
  "mood": [
   "웃긴",
   "따뜻한"
  ],
  "blurb": "알파벳 26글자가 하나씩 코코넛 나무 위로 올라가는 유쾌한 이야기로, 신나는 리듬과 반복 문장 덕분에 영어 알파벳을 자연스럽게 익힐 수 있어요.",
  "readAloud": "\"Chicka chicka boom boom!\" 후렴구를 아이와 함께 크게 따라 외치며 리듬감을 살려 읽어 보세요!",
  "cover": {
   "emoji": "🌴",
   "palette": [
    "#E8A020",
    "#3DAA5C"
   ]
  },
  "quality": 0.95,
  "source": "curated"
 },
 {
  "id": "en-polar-bear-polar-bear-what-do-yo-3652",
  "lang": "en",
  "title": "Polar Bear, Polar Bear, What Do You Hear?",
  "author": "Bill Martin Jr. & Eric Carle",
  "publisher": "",
  "isbn": "9780805053883",
  "ages": [
   "0-2",
   "3-4",
   "5-6"
  ],
  "level": "보드북",
  "themes": [
   "동물",
   "숫자/글자",
   "일상"
  ],
  "mood": [
   "따뜻한",
   "학습"
  ],
  "blurb": "북극곰부터 공작새까지, 동물들이 내는 소리를 리듬감 넘치는 반복 구조로 배울 수 있는 감각적인 그림책이에요.",
  "readAloud": "각 동물 소리를 직접 흉내 내며 읽어 주면 아이가 더욱 신나게 참여해요!",
  "cover": {
   "emoji": "🐻‍❄️",
   "palette": [
    "#FFFFFF",
    "#1A6FAF"
   ]
  },
  "quality": 0.97,
  "source": "curated"
 },
 {
  "id": "en-the-mitten-c101",
  "lang": "en",
  "title": "The Mitten",
  "author": "Jan Brett",
  "publisher": "",
  "isbn": "9780399219207",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "동물",
   "환상",
   "자연",
   "유머"
  ],
  "mood": [
   "웃긴",
   "따뜻한"
  ],
  "blurb": "눈 속에 떨어진 하얀 벙어리장갑 안으로 동물들이 하나둘 비집고 들어오는 유쾌한 이야기로, Jan Brett의 섬세하고 아름다운 그림이 매 페이지를 풍성하게 채워 줍니다.",
  "readAloud": "동물이 새로 등장할 때마다 \"다음엔 누가 들어올까?\" 하고 아이에게 먼저 물어보세요!",
  "cover": {
   "emoji": "🧤",
   "palette": [
    "#FFFFFF",
    "#4A90D9"
   ]
  },
  "quality": 0.92,
  "source": "curated"
 },
 {
  "id": "en-frederick-b6ce",
  "lang": "en",
  "title": "Frederick",
  "author": "Leo Lionni",
  "publisher": "",
  "isbn": "9780394826141",
  "ages": [
   "3-4",
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "동물",
   "감정",
   "자연",
   "친구"
  ],
  "mood": [
   "잔잔한",
   "따뜻한"
  ],
  "blurb": "겨울을 앞두고 동료 들쥐들이 먹이를 모으는 동안, 프레데릭은 햇살·색깔·이야기를 모읍니다. 상상력과 예술이 삶을 얼마나 풍요롭게 하는지를 따뜻하게 일깨워 주는 고전 그림책입니다.",
  "readAloud": "\"너는 왜 일 안 해?\" 대목에서 아이와 함께 프레데릭이 모은 것들이 무엇인지 이야기 나눠 보세요.",
  "cover": {
   "emoji": "🐭",
   "palette": [
    "#A8B5A2",
    "#E8D9B0"
   ]
  },
  "quality": 0.97,
  "source": "curated"
 },
 {
  "id": "en-swimmy-298b",
  "lang": "en",
  "title": "Swimmy",
  "author": "Leo Lionni",
  "publisher": "",
  "isbn": "9780394817132",
  "ages": [
   "3-4",
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "동물",
   "친구",
   "모험",
   "자연"
  ],
  "mood": [
   "따뜻한",
   "모험"
  ],
  "blurb": "혼자서는 작고 약한 물고기들이 힘을 합쳐 커다란 물고기 모양을 이루는 이야기로, 협동과 용기의 소중함을 아름다운 그림과 함께 전해줍니다.",
  "readAloud": "아이와 함께 \"우리가 힘을 합치면 어떤 일이 생길까?\" 질문을 던지며 읽어보세요.",
  "cover": {
   "emoji": "🐟",
   "palette": [
    "#1A6B8A",
    "#E8424A"
   ]
  },
  "quality": 0.97,
  "source": "curated"
 },
 {
  "id": "en-little-blue-and-little-yellow-9d41",
  "lang": "en",
  "title": "Little Blue and Little Yellow",
  "author": "Leo Lionni",
  "publisher": "",
  "isbn": "9780688132859",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "친구",
   "감정",
   "가족"
  ],
  "mood": [
   "따뜻한",
   "학습"
  ],
  "blurb": "파란 동그라미와 노란 동그라미가 서로 꼭 껴안자 초록색이 되어버리는, 우정과 색깔의 신비를 동시에 담은 사랑스러운 이야기입니다.",
  "readAloud": "두 색깔이 합쳐지는 장면에서 아이와 함께 \"빨강+노랑=?\" 처럼 다른 색 혼합도 직접 맞혀 보세요!",
  "cover": {
   "emoji": "🔵",
   "palette": [
    "#4A90D9",
    "#F5E642"
   ]
  },
  "quality": 0.92,
  "source": "curated"
 },
 {
  "id": "en-alexander-and-the-wind-up-mouse-4fcc",
  "lang": "en",
  "title": "Alexander and the Wind-Up Mouse",
  "author": "Leo Lionni",
  "publisher": "",
  "isbn": "9780394809144",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "친구",
   "동물",
   "감정",
   "환상"
  ],
  "mood": [
   "따뜻한",
   "잔잔한"
  ],
  "blurb": "쫓겨 다니는 생쥐 알렉산더는 사랑받는 태엽 쥐 윌리를 부러워하지만, 진정한 우정이 무엇인지 깨달아 가는 따뜻한 이야기입니다.",
  "readAloud": "\"너는 어떤 친구가 되고 싶어?\" 하고 아이에게 물어보며 읽어 주세요.",
  "cover": {
   "emoji": "🐭",
   "palette": [
    "#7B9E6B",
    "#D97B4F"
   ]
  },
  "quality": 0.92,
  "source": "curated"
 },
 {
  "id": "en-pancakes-for-breakfast-4680",
  "lang": "en",
  "title": "Pancakes for Breakfast",
  "author": "Tomie dePaola",
  "publisher": "",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "음식",
   "일상",
   "동물"
  ],
  "mood": [
   "잔잔한",
   "따뜻한"
  ],
  "blurb": "팬케이크가 먹고 싶은 할머니가 재료를 하나하나 구해 아침을 준비하는 따뜻하고 소박한 이야기로, 글 없이 그림만으로도 이야기를 충분히 전달하는 독특한 그림책입니다.",
  "readAloud": "각 장면에서 \"다음엔 뭐가 필요할까?\" 하고 아이와 함께 그림을 짚으며 이야기를 만들어 보세요.",
  "cover": {
   "emoji": "🥞",
   "palette": [
    "#F5C842",
    "#D94F2B"
   ]
  },
  "quality": 0.88,
  "source": "curated"
 },
 {
  "id": "en-strega-nona-157f",
  "lang": "en",
  "title": "Strega Nona",
  "author": "Tomie dePaola",
  "publisher": "",
  "isbn": "9780671666064",
  "ages": [
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "환상",
   "음식",
   "유머",
   "모험"
  ],
  "mood": [
   "웃긴",
   "따뜻한"
  ],
  "blurb": "마법의 파스타 냄비가 멈추지 않아 온 마을이 국수로 뒤덮일 위기에 처한다는 유쾌하고 따뜻한 이탈리아 민화풍 그림책으로, 욕심과 책임에 대한 교훈을 자연스럽게 전합니다.",
  "readAloud": "\"버블, 버블, 파스타 냄비야~\" 주문을 함께 외치며 읽어 주세요!",
  "cover": {
   "emoji": "🍝",
   "palette": [
    "#C0392B",
    "#F5CBA7"
   ]
  },
  "quality": 0.97,
  "source": "curated"
 },
 {
  "id": "en-the-tale-of-peter-rabbit-0bb3",
  "lang": "en",
  "title": "The Tale of Peter Rabbit",
  "author": "Beatrix Potter",
  "publisher": "",
  "isbn": "9780723247708",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "동물",
   "모험",
   "자연",
   "가족"
  ],
  "mood": [
   "모험",
   "따뜻한"
  ],
  "blurb": "말썽꾸러기 토끼 피터가 맥그리거 아저씨의 텃밭에 몰래 들어갔다가 쫓기는 짜릿한 모험 이야기로, 엄마의 따뜻한 품으로 돌아오는 결말이 마음을 포근하게 해줍니다.",
  "readAloud": "피터가 쫓길 때는 목소리를 높여 긴장감을 살리고, 마지막 장면에서는 차분하게 읽어 아이가 안도감을 느끼도록 해 보세요.",
  "cover": {
   "emoji": "🐰",
   "palette": [
    "#7BAE7F",
    "#F5E6C8"
   ]
  },
  "quality": 1,
  "source": "curated"
 },
 {
  "id": "en-the-tale-of-jemima-puddle-duck-235d",
  "lang": "en",
  "title": "The Tale of Jemima Puddle-Duck",
  "author": "Beatrix Potter",
  "publisher": "",
  "isbn": "9780723247746",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "동물",
   "환상",
   "모험"
  ],
  "mood": [
   "잔잔한",
   "따뜻한"
  ],
  "blurb": "오리 제미마가 알을 품을 곳을 찾아 떠나는 여정에서 교활한 여우를 만나게 되는 이야기로, 순진함과 위험 속에서 살아남는 지혜를 따뜻하게 그려냅니다.",
  "readAloud": "여우의 말투를 달콤하고 의심스럽게 연기하며 읽어 주면 긴장감과 재미가 배가돼요!",
  "cover": {
   "emoji": "🦆",
   "palette": [
    "#a8c5a0",
    "#f5e6c8"
   ]
  },
  "quality": 0.97,
  "source": "curated"
 },
 {
  "id": "en-the-tale-of-benjamin-bunny-3f3b",
  "lang": "en",
  "title": "The Tale of Benjamin Bunny",
  "author": "Beatrix Potter",
  "publisher": "",
  "isbn": "9780723247722",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "동물",
   "모험",
   "가족",
   "자연"
  ],
  "mood": [
   "잔잔한",
   "모험"
  ],
  "blurb": "피터 래빗의 사촌 벤자민이 맥그리거 아저씨 정원에서 벌어지는 작은 모험을 통해 용기와 가족의 소중함을 느끼게 해주는 비어트릭스 포터의 사랑스러운 고전입니다.",
  "readAloud": "벤자민과 피터가 조마조마한 순간마다 아이에게 \"어떻게 하면 좋을까?\" 물으며 함께 이야기를 이어가 보세요.",
  "cover": {
   "emoji": "🐰",
   "palette": [
    "#8FBC8F",
    "#F5DEB3"
   ]
  },
  "quality": 0.95,
  "source": "curated"
 },
 {
  "id": "en-the-tale-of-squirrel-nutkin-25c3",
  "lang": "en",
  "title": "The Tale of Squirrel Nutkin",
  "author": "Beatrix Potter",
  "publisher": "",
  "isbn": "9780723247715",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "동물",
   "자연",
   "모험",
   "유머"
  ],
  "mood": [
   "잔잔한",
   "웃긴"
  ],
  "blurb": "버릇없고 장난꾸러기 다람쥐 넛킨이 올빼미 할아버지에게 수수께끼를 던지며 벌어지는 유쾌한 이야기예요. 말썽을 부리다 꼬리를 잃을 뻔한 넛킨을 통해 예의와 결과에 대해 자연스럽게 생각해 볼 수 있답니다.",
  "readAloud": "수수께끼 부분에서 아이와 함께 답을 맞혀 보며 읽으면 더욱 재미있어요!",
  "cover": {
   "emoji": "🐿️",
   "palette": [
    "#D2691E",
    "#4E7C3F"
   ]
  },
  "quality": 0.93,
  "source": "curated"
 },
 {
  "id": "en-the-tale-of-mrs-tiggy-winkle-46db",
  "lang": "en",
  "title": "The Tale of Mrs. Tiggy-Winkle",
  "author": "Beatrix Potter",
  "publisher": "",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "동물",
   "일상",
   "환상",
   "가족"
  ],
  "mood": [
   "따뜻한",
   "잔잔한"
  ],
  "blurb": "작은 고슴도치 세탁부 티기-윙클 아주머니의 아늑한 집을 배경으로, 잃어버린 손수건을 찾아 나선 루시의 포근하고 사랑스러운 모험 이야기예요.",
  "readAloud": "티기-윙클 아주머니의 대사를 읽을 때 귀엽고 바삐 움직이는 목소리로 연기해 보세요!",
  "cover": {
   "emoji": "🦔",
   "palette": [
    "#6B8E5A",
    "#F5E6C8"
   ]
  },
  "quality": 0.9,
  "source": "curated"
 },
 {
  "id": "en-the-cat-in-the-hat-0361",
  "lang": "en",
  "title": "The Cat in the Hat",
  "author": "Dr. Seuss",
  "publisher": "",
  "isbn": "9780394800011",
  "ages": [
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "유머",
   "환상",
   "일상",
   "친구"
  ],
  "mood": [
   "웃긴",
   "모험"
  ],
  "blurb": "비 오는 지루한 날, 커다란 모자를 쓴 수상한 고양이가 나타나 집 안을 온통 뒤집어 놓는 엉뚱하고 유쾌한 이야기예요!",
  "readAloud": "고양이의 대사를 과장된 목소리로 읽어 주면 아이들이 더욱 신나게 즐길 수 있어요.",
  "cover": {
   "emoji": "🎩",
   "palette": [
    "#E63946",
    "#F1FAEE"
   ]
  },
  "quality": 1,
  "source": "curated"
 },
 {
  "id": "en-the-lorax-927d",
  "lang": "en",
  "title": "The Lorax",
  "author": "Dr. Seuss",
  "publisher": "",
  "isbn": "9780394823379",
  "ages": [
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "자연",
   "환상",
   "동물",
   "감정"
  ],
  "mood": [
   "따뜻한",
   "학습"
  ],
  "blurb": "로락스라는 작은 수호자가 나무와 동물들을 지키기 위해 목소리를 높이는 이야기로, 환경을 소중히 여기는 마음을 자연스럽게 심어줍니다.",
  "readAloud": "나무가 하나씩 사라질 때마다 아이에게 \"우리가 할 수 있는 일은 뭐가 있을까?\" 하고 물어보세요.",
  "cover": {
   "emoji": "🌳",
   "palette": [
    "#F4A636",
    "#5B8A3C"
   ]
  },
  "quality": 0.97,
  "source": "curated"
 },
 {
  "id": "en-green-eggs-and-ham-191d",
  "lang": "en",
  "title": "Green Eggs and Ham",
  "author": "Dr. Seuss",
  "publisher": "",
  "isbn": "9780394800165",
  "ages": [
   "3-4",
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "음식",
   "유머",
   "감정",
   "일상"
  ],
  "mood": [
   "웃긴",
   "따뜻한"
  ],
  "blurb": "\"싫어요, 먹기 싫다고요!\" 고집쟁이 주인공이 초록 달걀과 햄을 맛보기까지 벌어지는 유쾌한 설득 대작전 — 새로운 것에 도전하는 용기를 웃음으로 가르쳐 주는 닥터 수스의 고전입니다.",
  "readAloud": "Sam-I-Am의 신나는 반복 대사를 아이와 번갈아 읽으며 목소리를 과장되게 바꿔 보세요!",
  "cover": {
   "emoji": "🍳",
   "palette": [
    "#6DBF67",
    "#F7E03C"
   ]
  },
  "quality": 0.97,
  "source": "curated"
 },
 {
  "id": "en-how-the-grinch-stole-christmas-d5ae",
  "lang": "en",
  "title": "How the Grinch Stole Christmas!",
  "author": "Dr. Seuss",
  "publisher": "",
  "isbn": "9780394800790",
  "ages": [
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "감정",
   "환상",
   "가족",
   "유머"
  ],
  "mood": [
   "웃긴",
   "따뜻한"
  ],
  "blurb": "크리스마스를 빼앗으려던 심술쟁이 그린치가 결국 사랑의 진정한 의미를 깨닫는 이야기로, 명절의 따뜻한 정신을 유쾌하게 전합니다.",
  "readAloud": "그린치의 심술궂은 표정을 흉내 내며 읽다가, 마지막 장면에서는 목소리를 부드럽게 바꿔 보세요!",
  "cover": {
   "emoji": "🎄",
   "palette": [
    "#2E7D32",
    "#C62828"
   ]
  },
  "quality": 1,
  "source": "curated"
 },
 {
  "id": "en-oh-the-places-you-ll-go-62e1",
  "lang": "en",
  "title": "Oh, the Places You'll Go!",
  "author": "Dr. Seuss",
  "publisher": "",
  "isbn": "9780679805274",
  "ages": [
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "모험",
   "감정",
   "환상",
   "일상"
  ],
  "mood": [
   "따뜻한",
   "모험"
  ],
  "blurb": "넓고 넓은 세상으로 나아가는 어린이에게 보내는 따뜻한 응원가로, 인생의 오르막과 내리막을 유쾌한 그림과 리듬감 넘치는 글로 담아냈어요. 졸업·입학 등 새 출발을 앞둔 아이에게 꼭 선물하고 싶은 책이에요.",
  "readAloud": "리듬과 라임이 살아있으니 목소리를 크게 높였다 낮추며 신나게 읽어 주세요!",
  "cover": {
   "emoji": "🎈",
   "palette": [
    "#F7C948",
    "#E8453C"
   ]
  },
  "quality": 0.97,
  "source": "curated"
 },
 {
  "id": "en-one-fish-two-fish-red-fish-blue--487f",
  "lang": "en",
  "title": "One Fish Two Fish Red Fish Blue Fish",
  "author": "Dr. Seuss",
  "publisher": "",
  "isbn": "9780394800134",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "숫자/글자",
   "동물",
   "유머",
   "일상"
  ],
  "mood": [
   "웃긴",
   "잔잔한"
  ],
  "blurb": "빨간 물고기, 파란 물고기, 하나, 둘… 닥터 수스 특유의 신나는 라임과 엉뚱한 그림으로 숫자·색깔·반대말을 자연스럽게 익힐 수 있는 클래식 그림책이에요.",
  "readAloud": "물고기 색깔과 숫자를 아이와 번갈아 외치며 읽으면 더 신나요!",
  "cover": {
   "emoji": "🐟",
   "palette": [
    "#E83B2A",
    "#2A6DB5"
   ]
  },
  "quality": 0.97,
  "source": "curated"
 },
 {
  "id": "en-horton-hears-a-who-9743",
  "lang": "en",
  "title": "Horton Hears a Who!",
  "author": "Dr. Seuss",
  "publisher": "",
  "isbn": "9780394800783",
  "ages": [
   "3-4",
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "동물",
   "환상",
   "감정",
   "친구"
  ],
  "mood": [
   "따뜻한",
   "모험"
  ],
  "blurb": "코끼리 호튼은 먼지 한 톨 위에 작은 생명체들이 살고 있다는 것을 발견하고, 아무도 믿어주지 않아도 끝까지 그들을 지켜냅니다. \"아무리 작아도 생명은 소중하다\"는 따뜻한 메시지를 전하는 닥터 수스의 고전입니다.",
  "readAloud": "호튼이 \"A person's a person, no matter how small!\"을 외칠 때 아이와 함께 힘차게 따라 읽어 보세요!",
  "cover": {
   "emoji": "🐘",
   "palette": [
    "#F4A623",
    "#5B8CDB"
   ]
  },
  "quality": 0.97,
  "source": "curated"
 },
 {
  "id": "en-fox-in-socks-c5e8",
  "lang": "en",
  "title": "Fox in Socks",
  "author": "Dr. Seuss",
  "publisher": "",
  "isbn": "9780394800387",
  "ages": [
   "3-4",
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "유머",
   "동물",
   "일상"
  ],
  "mood": [
   "웃긴",
   "모험"
  ],
  "blurb": "양말 신은 여우가 점점 빨라지는 말장난으로 독자를 웃음의 소용돌이로 끌어들이는 닥터 수스의 대표 언어 유희 그림책이에요. 빠르게 소리 내어 읽다 보면 혀가 꼬이는 재미가 폭발합니다!",
  "readAloud": "처음엔 천천히, 점점 빠르게 읽으며 아이와 '혀 꼬이기' 대결을 해 보세요!",
  "cover": {
   "emoji": "🦊",
   "palette": [
    "#E8392A",
    "#F5F0E8"
   ]
  },
  "quality": 0.97,
  "source": "curated"
 },
 {
  "id": "en-knuffle-bunny-too-caaa",
  "lang": "en",
  "title": "Knuffle Bunny Too",
  "author": "Mo Willems",
  "publisher": "",
  "isbn": "9781423102991",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "친구",
   "가족",
   "일상",
   "감정"
  ],
  "mood": [
   "웃긴",
   "따뜻한"
  ],
  "blurb": "트릭시는 학교에서 자신만의 특별한 인형 너플 버니가 있다고 자랑했지만, 친구 소냐도 똑같은 너플 버니를 가지고 있다는 걸 발견하게 돼요! 작은 오해와 뒤바뀐 인형을 둘러싼 유쾌하고 따뜻한 우정 이야기입니다.",
  "readAloud": "인형이 바뀐 장면에서 아이에게 \"네가 트릭시라면 어떤 기분일까?\" 물어보며 감정을 이야기해 보세요.",
  "cover": {
   "emoji": "🐰",
   "palette": [
    "#F4C842",
    "#4A90D9"
   ]
  },
  "quality": 0.92,
  "source": "curated"
 },
 {
  "id": "en-knuffle-bunny-free-b2c3",
  "lang": "en",
  "title": "Knuffle Bunny Free",
  "author": "Mo Willems",
  "publisher": "",
  "isbn": "9780061929571",
  "ages": [
   "3-4",
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "가족",
   "친구",
   "모험",
   "감정"
  ],
  "mood": [
   "따뜻한",
   "잔잔한"
  ],
  "blurb": "트릭시가 사랑하는 인형 너플 버니와 작별을 고하는 이야기로, 성장하며 소중한 것을 나눌 줄 알게 되는 따뜻한 감동을 전합니다.",
  "readAloud": "트릭시가 너플 버니를 보내주는 장면에서 아이에게 \"네가 가장 소중한 것을 친구에게 줄 수 있을까?\" 하고 물어보세요.",
  "cover": {
   "emoji": "🐰",
   "palette": [
    "#f5e6c8",
    "#4a90d9"
   ]
  },
  "quality": 0.92,
  "source": "curated"
 },
 {
  "id": "en-the-pigeon-finds-a-hot-dog-19de",
  "lang": "en",
  "title": "The Pigeon Finds a Hot Dog!",
  "author": "Mo Willems",
  "publisher": "",
  "isbn": "9780786818693",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "유머",
   "음식",
   "감정",
   "동물"
  ],
  "mood": [
   "웃긴",
   "따뜻한"
  ],
  "blurb": "비둘기가 핫도그를 발견하고 혼자 먹으려 하지만, 꾀 많은 오리의 등장으로 나눔과 탐욕 사이에서 웃음이 터집니다.",
  "readAloud": "비둘기의 대사를 과장되게 읽어 주면 아이들이 배꼽을 잡아요 — \"냠냠냠\" 씹는 소리도 함께!",
  "cover": {
   "emoji": "🌭",
   "palette": [
    "#F7C948",
    "#4A90D9"
   ]
  },
  "quality": 0.93,
  "source": "curated"
 },
 {
  "id": "en-don-t-let-the-pigeon-stay-up-lat-5d13",
  "lang": "en",
  "title": "Don't Let the Pigeon Stay Up Late!",
  "author": "Mo Willems",
  "publisher": "",
  "isbn": "9781423109945",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "잠자리",
   "유머",
   "감정",
   "일상"
  ],
  "mood": [
   "웃긴",
   "따뜻한"
  ],
  "blurb": "비둘기가 온갖 핑계를 대며 잠자리에 들기 싫다고 떼를 쓰는 모습이 너무 사랑스럽고 웃겨서, 읽는 어른도 아이도 함께 빵 터지게 만드는 책이에요!",
  "readAloud": "비둘기의 대사를 최대한 칭얼대는 목소리로 읽어 주면 아이가 더 신나게 반응해요!",
  "cover": {
   "emoji": "🐦",
   "palette": [
    "#F7C948",
    "#4A90D9"
   ]
  },
  "quality": 0.93,
  "source": "curated"
 },
 {
  "id": "en-there-is-a-bird-on-your-head-86c7",
  "lang": "en",
  "title": "There Is a Bird on Your Head!",
  "author": "Mo Willems",
  "publisher": "",
  "isbn": "9781423106869",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "동물",
   "유머",
   "감정",
   "친구"
  ],
  "mood": [
   "웃긴",
   "따뜻한"
  ],
  "blurb": "코끼리 제럴드의 머리 위에 새가 둥지를 틀면서 벌어지는 황당하고 유쾌한 소동! 친한 친구 피기와 함께 문제를 해결해 나가는 과정이 웃음을 터뜨리게 합니다.",
  "readAloud": "제럴드의 당황한 표정을 따라 하며 \"머리 위에 새가 있대!\" 하고 같이 외쳐 보세요.",
  "cover": {
   "emoji": "🐦",
   "palette": [
    "#F5E642",
    "#A8D8EA"
   ]
  },
  "quality": 0.97,
  "source": "curated"
 },
 {
  "id": "en-we-are-in-a-book-fcec",
  "lang": "en",
  "title": "We Are in a Book!",
  "author": "Mo Willems",
  "publisher": "",
  "isbn": "9781423133087",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "유머",
   "감정",
   "친구",
   "일상"
  ],
  "mood": [
   "웃긴",
   "따뜻한"
  ],
  "blurb": "코끼리 제럴드와 돼지 피기가 자신들이 책 속에 있다는 사실을 발견하고 독자를 향해 말을 거는, 메타픽션의 재미가 넘치는 유쾌한 이야기예요!",
  "readAloud": "아이와 함께 제럴드·피기의 대사를 실감 나게 따라 읽으며, \"바나나!\"를 외치는 장면에서 크게 소리쳐 보세요!",
  "cover": {
   "emoji": "🐘",
   "palette": [
    "#F9E04B",
    "#F4A03A"
   ]
  },
  "quality": 0.97,
  "source": "curated"
 },
 {
  "id": "en-waiting-is-not-easy-6677",
  "lang": "en",
  "title": "Waiting Is Not Easy!",
  "author": "Mo Willems",
  "publisher": "",
  "isbn": "9781423199571",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "감정",
   "친구",
   "일상"
  ],
  "mood": [
   "웃긴",
   "따뜻한"
  ],
  "blurb": "제럴드가 기다리기 너무 힘들다고 투덜댈 때, 피기는 끝까지 기다리면 얼마나 멋진 일이 생기는지 보여 줘요. 기다림의 가치를 유쾌하게 배울 수 있는 책이에요.",
  "readAloud": "제럴드의 투덜거리는 대사를 과장되게 읽어 주면 아이가 더 깔깔 웃어요!",
  "cover": {
   "emoji": "🐘",
   "palette": [
    "#F7C948",
    "#E8F5E9"
   ]
  },
  "quality": 0.95,
  "source": "curated"
 },
 {
  "id": "en-stuck-3944",
  "lang": "en",
  "title": "Stuck",
  "author": "Oliver Jeffers",
  "publisher": "",
  "isbn": "9780399257377",
  "ages": [
   "3-4",
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "유머",
   "모험",
   "일상"
  ],
  "mood": [
   "웃긴",
   "모험"
  ],
  "blurb": "연에 걸린 신발을 꺼내려다 온갖 엉뚱한 것들을 나무에 던져버리는 플로이드의 좌충우돌 이야기로, 터무니없는 상황이 계속 이어져 배꼽을 잡게 만드는 그림책이에요.",
  "readAloud": "각 물건이 나무에 걸릴 때마다 아이와 함께 \"다음엔 뭐가 걸릴까?\" 예측 놀이를 해 보세요!",
  "cover": {
   "emoji": "🪁",
   "palette": [
    "#5B9BD5",
    "#F4A623"
   ]
  },
  "quality": 0.88,
  "source": "curated"
 },
 {
  "id": "en-the-way-back-home-a913",
  "lang": "en",
  "title": "The Way Back Home",
  "author": "Oliver Jeffers",
  "publisher": "",
  "ages": [
   "3-4",
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "모험",
   "우주",
   "친구",
   "탈것"
  ],
  "mood": [
   "따뜻한",
   "모험"
  ],
  "blurb": "어느 날 비행기를 타고 하늘 높이 날아오른 소년이 달에 홀로 고립되고, 그곳에서 만난 외계인 친구와 힘을 합쳐 각자의 집으로 돌아가는 길을 찾는 따뜻한 우정 이야기입니다.",
  "readAloud": "\"집에 돌아가고 싶을 때 어떤 기분인지\" 아이와 함께 이야기 나누며 읽어 보세요.",
  "cover": {
   "emoji": "🚀",
   "palette": [
    "#1B2A4A",
    "#F5C842"
   ]
  },
  "quality": 0.88,
  "source": "curated"
 },
 {
  "id": "en-here-we-are-notes-for-living-on--05d9",
  "lang": "en",
  "title": "Here We Are: Notes for Living on Planet Earth",
  "author": "Oliver Jeffers",
  "publisher": "",
  "isbn": "9780399167898",
  "ages": [
   "3-4",
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "자연",
   "가족",
   "일상",
   "환상"
  ],
  "mood": [
   "따뜻한",
   "잔잔한"
  ],
  "blurb": "아빠가 갓 태어난 아이에게 지구라는 별에서 살아가는 법을 다정하게 알려주는 그림책으로, 우리가 사는 세상의 경이로움과 서로를 돌봐야 한다는 따뜻한 메시지를 담고 있어요.",
  "readAloud": "각 페이지에서 \"이건 뭐야?\" 하고 아이에게 먼저 물어보며 함께 지구를 탐험하듯 읽어보세요.",
  "cover": {
   "emoji": "🌍",
   "palette": [
    "#89C4E1",
    "#F5E6C8"
   ]
  },
  "quality": 0.93,
  "source": "curated"
 },
 {
  "id": "en-this-moose-belongs-to-me-fc5d",
  "lang": "en",
  "title": "This Moose Belongs to Me",
  "author": "Oliver Jeffers",
  "publisher": "",
  "isbn": "9780399161032",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "동물",
   "감정",
   "친구",
   "유머"
  ],
  "mood": [
   "웃긴",
   "따뜻한"
  ],
  "blurb": "자기 규칙을 철저히 따르는 소년 윌프레드는 커다란 무스가 자기 것이라고 굳게 믿지만, 무스는 전혀 다른 생각인 것 같아요! 소유와 우정의 의미를 유쾌하게 풀어낸 그림책입니다.",
  "readAloud": "\"무스의 규칙\"과 \"윌프레드의 규칙\"을 번갈아 읽어 주며 아이와 함께 누구 말이 맞는지 이야기해 보세요.",
  "cover": {
   "emoji": "🫎",
   "palette": [
    "#c8dbe8",
    "#a0522d"
   ]
  },
  "quality": 0.88,
  "source": "curated"
 },
 {
  "id": "en-the-jolly-postman-e318",
  "lang": "en",
  "title": "The Jolly Postman",
  "author": "Janet & Allan Ahlberg",
  "publisher": "",
  "isbn": "9780316126441",
  "ages": [
   "3-4",
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "환상",
   "친구",
   "일상",
   "유머"
  ],
  "mood": [
   "웃긴",
   "따뜻한"
  ],
  "blurb": "유쾌한 우체부 아저씨가 동화 속 주인공들—아기돼지 삼형제, 신데렐라, 마녀 할머니—에게 편지와 엽서를 배달하는 이야기로, 책 속에 실제로 꺼내 볼 수 있는 편지가 봉투째 들어 있어 읽는 재미가 두 배예요!",
  "readAloud": "봉투에서 편지를 직접 꺼내 아이가 소리 내어 읽게 해 주세요—우편배달부 놀이로 이어지면 더욱 신나요!",
  "cover": {
   "emoji": "✉️",
   "palette": [
    "#F4A623",
    "#4A90D9"
   ]
  },
  "quality": 0.93,
  "source": "curated"
 },
 {
  "id": "en-peepo-d891",
  "lang": "en",
  "title": "Peepo!",
  "author": "Janet & Allan Ahlberg",
  "publisher": "",
  "isbn": "9780140502107",
  "ages": [
   "0-2",
   "3-4"
  ],
  "level": "보드북",
  "themes": [
   "일상",
   "가족",
   "환상"
  ],
  "mood": [
   "따뜻한",
   "잔잔한"
  ],
  "blurb": "2차 세계대전을 배경으로, 아기의 눈에 비친 하루하루의 소소한 일상과 가족의 온기를 동그란 구멍 너머로 엿보는 독특한 그림책입니다. 반복되는 \"피포!\" 리듬이 아기와 부모 모두를 사로잡아요.",
  "readAloud": "구멍 페이지마다 \"피포!\" 하고 외치며 다음 장면을 함께 맞혀 보세요.",
  "cover": {
   "emoji": "👶",
   "palette": [
    "#F5E6C8",
    "#8B6F47"
   ]
  },
  "quality": 0.93,
  "source": "curated"
 },
 {
  "id": "en-funnybones-a58d",
  "lang": "en",
  "title": "Funnybones",
  "author": "Janet & Allan Ahlberg",
  "publisher": "",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "유머",
   "환상",
   "일상"
  ],
  "mood": [
   "웃긴",
   "모험"
  ],
  "blurb": "해골 가족이 밤마다 도시를 누비며 벌이는 유쾌하고 엉뚱한 소동! 무서울 것 같지만 웃음이 먼저 터지는 이야기예요.",
  "readAloud": "해골 흉내를 내며 \"덜컹덜컹\" 소리를 같이 내보세요—아이들이 까르르 웃을 거예요!",
  "cover": {
   "emoji": "💀",
   "palette": [
    "#1a1a2e",
    "#f5f0e8"
   ]
  },
  "quality": 0.88,
  "source": "curated"
 },
 {
  "id": "en-the-baby-s-catalogue-cad7",
  "lang": "en",
  "title": "The Baby's Catalogue",
  "author": "Janet & Allan Ahlberg",
  "publisher": "",
  "ages": [
   "0-2",
   "3-4"
  ],
  "level": "보드북",
  "themes": [
   "일상",
   "가족",
   "동물"
  ],
  "mood": [
   "따뜻한",
   "잔잔한"
  ],
  "blurb": "아기의 하루를 가득 채우는 모든 것들—아침밥, 장난감, 낮잠, 목욕—을 카탈로그처럼 나열하며 아기와 가족의 일상을 사랑스럽게 담아낸 책이에요.",
  "readAloud": "페이지마다 그림 속 사물을 손가락으로 짚어 가며 아이와 함께 이름을 말해 보세요.",
  "cover": {
   "emoji": "👶",
   "palette": [
    "#F9E4B7",
    "#A8D8A8"
   ]
  },
  "quality": 0.82,
  "source": "curated"
 },
 {
  "id": "en-the-mixed-up-chameleon-684c",
  "lang": "en",
  "title": "The Mixed-Up Chameleon",
  "author": "Eric Carle",
  "publisher": "",
  "isbn": "9780064431620",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "동물",
   "감정",
   "일상"
  ],
  "mood": [
   "웃긴",
   "따뜻한"
  ],
  "blurb": "지루한 카멜레온이 다른 동물들의 모습을 하나씩 갖고 싶어 하다가 결국 자기 자신이 최고임을 깨닫는 유쾌하고 따뜻한 이야기예요.",
  "readAloud": "각 동물 이름을 읽을 때 그 동물 소리나 몸짓을 함께 흉내 내며 읽으면 훨씬 재미있어요!",
  "cover": {
   "emoji": "🦎",
   "palette": [
    "#E63B2E",
    "#4BAF4F"
   ]
  },
  "quality": 0.88,
  "source": "curated"
 },
 {
  "id": "en-the-grouchy-ladybug-dfb2",
  "lang": "en",
  "title": "The Grouchy Ladybug",
  "author": "Eric Carle",
  "publisher": "",
  "isbn": "9780064434508",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "동물",
   "감정",
   "일상"
  ],
  "mood": [
   "웃긴",
   "따뜻한"
  ],
  "blurb": "아침부터 싸움을 걸며 돌아다니던 심술쟁이 무당벌레가 하루 종일 다양한 동물들을 만나고 나서야 나눔과 친절의 소중함을 깨닫는 이야기예요.",
  "readAloud": "시간이 바뀌는 장면마다 \"지금 몇 시예요?\" 하고 물어보며 시계 읽기를 함께 해보세요!",
  "cover": {
   "emoji": "🐞",
   "palette": [
    "#E83B2A",
    "#F5C842"
   ]
  },
  "quality": 0.95,
  "source": "curated"
 },
 {
  "id": "en-from-head-to-toe-3416",
  "lang": "en",
  "title": "From Head to Toe",
  "author": "Eric Carle",
  "publisher": "",
  "isbn": "9780064435963",
  "ages": [
   "0-2",
   "3-4",
   "5-6"
  ],
  "level": "보드북",
  "themes": [
   "동물",
   "일상",
   "숫자/글자"
  ],
  "mood": [
   "웃긴",
   "학습"
  ],
  "blurb": "기린, 펭귄, 원숭이 등 다양한 동물들의 몸짓을 따라 하며 신체 부위와 움직임을 즐겁게 익히는 에릭 칼의 인터랙티브 그림책입니다.",
  "readAloud": "\"나도 할 수 있어요!\" 대사가 나올 때마다 아이가 직접 동물 동작을 따라 하게 해 보세요!",
  "cover": {
   "emoji": "🦒",
   "palette": [
    "#F5A623",
    "#4A90D9"
   ]
  },
  "quality": 0.88,
  "source": "curated"
 },
 {
  "id": "en-papa-please-get-the-moon-for-me-311d",
  "lang": "en",
  "title": "Papa, Please Get the Moon for Me",
  "author": "Eric Carle",
  "publisher": "",
  "isbn": "9780887080265",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "가족",
   "환상",
   "자연",
   "감정"
  ],
  "mood": [
   "따뜻한",
   "모험"
  ],
  "blurb": "달을 갖고 싶다는 딸을 위해 아빠가 사다리를 타고 하늘 끝까지 올라가 달을 따다 주는, 아빠의 한없는 사랑을 담은 그림책입니다. 에릭 칼 특유의 콜라주 일러스트와 펼쳐지는 특대 페이지가 아이들의 눈과 마음을 사로잡습니다.",
  "readAloud": "달이 점점 커졌다 작아지는 페이지를 펼칠 때 \"우와!\" 하며 함께 탄성을 질러 보세요.",
  "cover": {
   "emoji": "🌕",
   "palette": [
    "#1B2A6B",
    "#F5C518"
   ]
  },
  "quality": 0.92,
  "source": "curated"
 },
 {
  "id": "en-a-house-for-hermit-crab-d1bd",
  "lang": "en",
  "title": "A House for Hermit Crab",
  "author": "Eric Carle",
  "publisher": "",
  "isbn": "9780887080562",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "동물",
   "자연",
   "일상",
   "친구"
  ],
  "mood": [
   "따뜻한",
   "잔잔한"
  ],
  "blurb": "껍데기가 작아진 소라게가 새 집을 찾아 꾸며 나가는 이야기로, 성장과 변화에 대한 두려움을 자연스럽게 극복하는 모습을 담았어요.",
  "readAloud": "각 달마다 새로운 친구가 등장할 때 \"다음엔 누가 올까?\" 하고 함께 예측해 보세요!",
  "cover": {
   "emoji": "🐚",
   "palette": [
    "#F4A460",
    "#4682B4"
   ]
  },
  "quality": 0.9,
  "source": "curated"
 },
 {
  "id": "en-chicka-chicka-1-2-3-0cdf",
  "lang": "en",
  "title": "Chicka Chicka 1, 2, 3",
  "author": "Bill Martin Jr. & Michael Sampson",
  "publisher": "",
  "isbn": "9780689858819",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "숫자/글자",
   "유머",
   "동물",
   "일상"
  ],
  "mood": [
   "웃긴",
   "학습"
  ],
  "blurb": "숫자 1부터 100까지가 사과나무에 올라가려고 아옹다옹 모여드는 유쾌한 이야기로, 신나는 리듬감 속에 숫자 개념을 자연스럽게 익힐 수 있어요.",
  "readAloud": "숫자가 나올 때마다 아이와 함께 손가락으로 세어 보며 큰 소리로 따라 읽어 보세요!",
  "cover": {
   "emoji": "🔢",
   "palette": [
    "#F4A623",
    "#4CAF50"
   ]
  },
  "quality": 0.72,
  "source": "curated"
 },
 {
  "id": "en-the-going-to-bed-book-5ebf",
  "lang": "en",
  "title": "The Going to Bed Book",
  "author": "Sandra Boynton",
  "publisher": "",
  "isbn": "9780671449025",
  "ages": [
   "0-2",
   "3-4"
  ],
  "level": "보드북",
  "themes": [
   "잠자리",
   "동물",
   "일상"
  ],
  "mood": [
   "웃긴",
   "잔잔한"
  ],
  "blurb": "배 위에 사는 온갖 동물 친구들이 목욕하고, 운동하고, 이를 닦은 뒤 포근하게 잠자리에 드는 이야기로, 아이의 취침 루틴을 유쾌하고 사랑스럽게 담아낸 보드북입니다.",
  "readAloud": "\"잘 자요~\" 페이지에서 목소리를 낮게 속삭이듯 읽어 주세요.",
  "cover": {
   "emoji": "🌙",
   "palette": [
    "#1B3A5C",
    "#F5C842"
   ]
  },
  "quality": 0.97,
  "source": "curated"
 },
 {
  "id": "en-moo-baa-la-la-la-eb6c",
  "lang": "en",
  "title": "Moo, Baa, La La La!",
  "author": "Sandra Boynton",
  "publisher": "",
  "isbn": "9780671449018",
  "ages": [
   "0-2",
   "3-4"
  ],
  "level": "보드북",
  "themes": [
   "동물",
   "유머",
   "숫자/글자"
  ],
  "mood": [
   "웃긴",
   "따뜻한"
  ],
  "blurb": "소, 양, 돼지… 동물 친구들의 울음소리를 신나게 따라 하다 보면 어느새 책 한 권이 끝! 샌드라 보인턴 특유의 유쾌한 그림과 리듬감 넘치는 문장이 아기의 귀와 눈을 사로잡는 스테디셀러 보드북이에요.",
  "readAloud": "각 동물이 나올 때 울음소리를 과장되게 흉내 내며 읽어 주면 아이가 깔깔 웃으며 따라 해요!",
  "cover": {
   "emoji": "🐄",
   "palette": [
    "#F5E642",
    "#F4A243"
   ]
  },
  "quality": 0.97,
  "source": "curated"
 },
 {
  "id": "en-but-not-the-hippopotamus-b3b8",
  "lang": "en",
  "title": "But Not the Hippopotamus",
  "author": "Sandra Boynton",
  "publisher": "",
  "isbn": "9780671449049",
  "ages": [
   "0-2",
   "3-4"
  ],
  "level": "보드북",
  "themes": [
   "동물",
   "감정",
   "친구",
   "유머"
  ],
  "mood": [
   "웃긴",
   "따뜻한"
  ],
  "blurb": "다른 동물 친구들이 신나게 어울리는 동안 혼자 멀찍이 서 있던 하마가 마침내 초대를 받는 이야기로, 소외감과 어울림의 기쁨을 유쾌하게 담아냈어요.",
  "readAloud": "하마가 초대받는 장면에서 아이와 함께 \"야호!\" 하고 크게 소리쳐 보세요!",
  "cover": {
   "emoji": "🦛",
   "palette": [
    "#C94B7B",
    "#F5E6C8"
   ]
  },
  "quality": 0.92,
  "source": "curated"
 },
 {
  "id": "en-barnyard-dance-bc51",
  "lang": "en",
  "title": "Barnyard Dance!",
  "author": "Sandra Boynton",
  "publisher": "",
  "isbn": "9781563054426",
  "ages": [
   "0-2",
   "3-4"
  ],
  "level": "보드북",
  "themes": [
   "동물",
   "일상",
   "유머"
  ],
  "mood": [
   "웃긴",
   "따뜻한"
  ],
  "blurb": "헛간 동물들이 신나는 음악에 맞춰 춤을 추는 유쾌한 보드북으로, 리듬감 넘치는 문장이 아이의 귀를 사로잡아요!",
  "readAloud": "노래하듯 리듬을 살려 읽어 주고, \"Stomp!\", \"Bow!\" 같은 동작을 아이와 함께 몸으로 따라 해 보세요.",
  "cover": {
   "emoji": "🐄",
   "palette": [
    "#F4A623",
    "#4A90D9"
   ]
  },
  "quality": 0.92,
  "source": "curated"
 },
 {
  "id": "en-blue-hat-green-hat-93dd",
  "lang": "en",
  "title": "Blue Hat, Green Hat",
  "author": "Sandra Boynton",
  "publisher": "",
  "isbn": "9780671493202",
  "ages": [
   "0-2",
   "3-4"
  ],
  "level": "보드북",
  "themes": [
   "동물",
   "숫자/글자",
   "유머",
   "일상"
  ],
  "mood": [
   "웃긴",
   "따뜻한"
  ],
  "blurb": "모자, 바지, 스웨터… 동물 친구들이 옷을 입는데, 칠면조 한 마리가 번번이 엉뚱하게 걸쳐 입어 웃음을 자아내요! 색깔과 옷 이름을 자연스럽게 익힐 수 있는 산드라 보인턴의 유쾌한 보드북입니다.",
  "readAloud": "\"OOPS!\" 페이지에서 목소리를 크게 높여 읽어 주면 아이가 까르르 웃으며 더욱 집중해요.",
  "cover": {
   "emoji": "🎩",
   "palette": [
    "#4A90D9",
    "#6ABF69"
   ]
  },
  "quality": 0.88,
  "source": "curated"
 },
 {
  "id": "en-snuggle-puppy-bff2",
  "lang": "en",
  "title": "Snuggle Puppy!",
  "author": "Sandra Boynton",
  "publisher": "",
  "isbn": "9780761147176",
  "ages": [
   "0-2",
   "3-4"
  ],
  "level": "보드북",
  "themes": [
   "동물",
   "가족",
   "감정"
  ],
  "mood": [
   "따뜻한",
   "웃긴"
  ],
  "blurb": "엄마(또는 아빠)가 아기 강아지에게 사랑을 듬뿍 노래로 고백하는 책으로, 읽어 주면서 아이와 꼭 안아 주고 싶어지는 따스한 그림책이에요.",
  "readAloud": "노래처럼 리듬감 있게 읽어 주면서 \"꼭 안아줄게!\" 하며 아이를 껴안아 보세요!",
  "cover": {
   "emoji": "🐶",
   "palette": [
    "#F9E04B",
    "#F4A7B9"
   ]
  },
  "quality": 0.88,
  "source": "curated"
 },
 {
  "id": "en-noisy-nora-14c4",
  "lang": "en",
  "title": "Noisy Nora",
  "author": "Rosemary Wells",
  "publisher": "",
  "isbn": "9780670035120",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "가족",
   "감정",
   "일상",
   "유머"
  ],
  "mood": [
   "웃긴",
   "따뜻한"
  ],
  "blurb": "막내도 아니고 첫째도 아닌 둘째 노라는 늘 관심에서 밀려나는 느낌에 온갖 소동을 일으키지만, 결국 가족의 사랑을 확인하는 유쾌한 이야기예요.",
  "readAloud": "노라가 소란을 피우는 장면마다 목소리를 크게 높여 읽어 주면 아이가 깔깔 웃으며 더 집중해요.",
  "cover": {
   "emoji": "🐭",
   "palette": [
    "#E8C97A",
    "#C0D9E8"
   ]
  },
  "quality": 0.88,
  "source": "curated"
 },
 {
  "id": "en-yoko-cad7",
  "lang": "en",
  "title": "Yoko",
  "author": "Rosemary Wells",
  "publisher": "",
  "isbn": "9780786814916",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "음식",
   "친구",
   "감정",
   "일상"
  ],
  "mood": [
   "따뜻한",
   "잔잔한"
  ],
  "blurb": "요코가 학교 점심시간에 싸 온 초밥 도시락이 친구들의 놀림감이 되지만, 결국 서로의 음식 문화를 이해하고 따뜻한 우정을 나누게 되는 이야기입니다.",
  "readAloud": "요코가 도시락을 꺼낼 때 아이에게 \"너는 어떤 음식이 제일 좋아?\"라고 물어보며 자연스럽게 대화를 열어보세요.",
  "cover": {
   "emoji": "🍱",
   "palette": [
    "#F5C842",
    "#D94F3D"
   ]
  },
  "quality": 0.88,
  "source": "curated"
 },
 {
  "id": "en-chicken-soup-with-rice-d57f",
  "lang": "en",
  "title": "Chicken Soup with Rice",
  "author": "Maurice Sendak",
  "publisher": "",
  "isbn": "9780064432535",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "음식",
   "숫자/글자",
   "일상",
   "유머"
  ],
  "mood": [
   "웃긴",
   "잔잔한"
  ],
  "blurb": "1월부터 12월까지, 어느 달이든 닭고기 쌀국수 수프 한 그릇이면 행복하다는 유쾌한 반복 노래 그림책이에요. 리듬감 넘치는 문장이 절로 흥얼거리게 만들어요!",
  "readAloud": "각 달 페이지를 읽을 때 \"chicken soup with rice!\" 부분을 아이와 함께 합창해 보세요.",
  "cover": {
   "emoji": "🍲",
   "palette": [
    "#E83B2A",
    "#F5E6C8"
   ]
  },
  "quality": 0.88,
  "source": "curated"
 },
 {
  "id": "en-in-the-night-kitchen-c635",
  "lang": "en",
  "title": "In the Night Kitchen",
  "author": "Maurice Sendak",
  "publisher": "",
  "isbn": "9780064434362",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "환상",
   "음식",
   "잠자리",
   "모험"
  ],
  "mood": [
   "웃긴",
   "모험"
  ],
  "blurb": "밤마다 잠든 사이 펼쳐지는 신나는 부엌 속 모험! 주인공 미키가 거대한 케이크 반죽 속으로 뛰어들며 꿈과 현실의 경계를 자유롭게 넘나드는 센닥 특유의 황홀한 환상 세계를 만나볼 수 있어요.",
  "readAloud": "반죽 속에 빠지는 장면에서 \"풍덩!\" 소리를 함께 크게 외치며 읽어 보세요!",
  "cover": {
   "emoji": "🌙",
   "palette": [
    "#F5C842",
    "#1A1A2E"
   ]
  },
  "quality": 0.95,
  "source": "curated"
 },
 {
  "id": "en-outside-over-there-83d4",
  "lang": "en",
  "title": "Outside Over There",
  "author": "Maurice Sendak",
  "publisher": "",
  "isbn": "9780064431859",
  "ages": [
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "환상",
   "가족",
   "모험",
   "감정"
  ],
  "mood": [
   "잔잔한",
   "모험"
  ],
  "blurb": "아빠가 바다로 떠난 사이, 고블린들이 아기 동생을 훔쳐가자 언니 이다가 마법 같은 여정으로 동생을 되찾는 이야기입니다. 센닥 특유의 몽환적이고 깊은 그림이 아이의 내면 세계를 섬세하게 담아냅니다.",
  "readAloud": "읽기 전에 표지 그림을 함께 살펴보며 \"이 아이는 지금 어떤 기분일까?\" 질문으로 이야기를 열어보세요.",
  "cover": {
   "emoji": "🌕",
   "palette": [
    "#d4c27a",
    "#4a6741"
   ]
  },
  "quality": 0.95,
  "source": "curated"
 },
 {
  "id": "en-planting-a-rainbow-7e1a",
  "lang": "en",
  "title": "Planting a Rainbow",
  "author": "Lois Ehlert",
  "publisher": "",
  "isbn": "9780152626105",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "자연",
   "일상"
  ],
  "mood": [
   "따뜻한",
   "학습"
  ],
  "blurb": "엄마와 아이가 함께 알뿌리를 심고 씨앗을 뿌려 무지개처럼 다채로운 꽃밭을 가꾸는 이야기로, 선명한 색채 그림과 함께 꽃 이름과 색깔을 자연스럽게 익힐 수 있어요.",
  "readAloud": "각 꽃 페이지에서 \"이 꽃은 무슨 색이야?\" 하고 물어보며 아이가 직접 색 이름을 맞혀보게 해보세요!",
  "cover": {
   "emoji": "🌈",
   "palette": [
    "#F4A300",
    "#6BBF4E"
   ]
  },
  "quality": 0.92,
  "source": "curated"
 },
 {
  "id": "en-color-zoo-1cec",
  "lang": "en",
  "title": "Color Zoo",
  "author": "Lois Ehlert",
  "publisher": "",
  "isbn": "9780397322596",
  "ages": [
   "0-2",
   "3-4",
   "5-6"
  ],
  "level": "보드북",
  "themes": [
   "동물",
   "숫자/글자",
   "그림그리기"
  ],
  "mood": [
   "학습",
   "따뜻한"
  ],
  "blurb": "동물 얼굴 속에 숨어 있는 도형들을 찾아보세요! 선명한 색깔과 구멍 뚫린 페이지로 색깔과 모양을 동시에 배울 수 있는 감각적인 그림책입니다.",
  "readAloud": "페이지를 넘길 때마다 \"이 모양 이름이 뭐게?\" 하고 물어보며 아이가 직접 맞혀보게 해 주세요.",
  "cover": {
   "emoji": "🦁",
   "palette": [
    "#E83A2F",
    "#F5A623"
   ]
  },
  "quality": 0.92,
  "source": "curated"
 },
 {
  "id": "en-growing-vegetable-soup-404d",
  "lang": "en",
  "title": "Growing Vegetable Soup",
  "author": "Lois Ehlert",
  "publisher": "",
  "isbn": "9780152325800",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "음식",
   "자연",
   "일상",
   "가족"
  ],
  "mood": [
   "따뜻한",
   "학습"
  ],
  "blurb": "아빠와 아이가 씨앗을 심고, 채소를 키우고, 직접 수프를 끓이기까지의 과정을 생생한 콜라주 그림으로 담은 책이에요. 텃밭 가꾸기의 즐거움과 먹거리가 자라는 신비를 아이의 눈높이에서 보여줍니다.",
  "readAloud": "채소 이름을 하나씩 짚어가며 읽고, 다 읽은 뒤 실제로 채소 수프를 함께 만들어 보세요!",
  "cover": {
   "emoji": "🥦",
   "palette": [
    "#4CAF50",
    "#FFF176"
   ]
  },
  "quality": 0.88,
  "source": "curated"
 },
 {
  "id": "en-red-leaf-yellow-leaf-75ed",
  "lang": "en",
  "title": "Red Leaf, Yellow Leaf",
  "author": "Lois Ehlert",
  "publisher": "",
  "isbn": "9780152661977",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "자연",
   "일상"
  ],
  "mood": [
   "잔잔한",
   "학습"
  ],
  "blurb": "단풍나무 한 그루가 씨앗에서 자라 마당에 뿌리내리기까지의 여정을 생생한 콜라주 그림으로 담아낸 책으로, 계절의 변화와 나무의 생애를 아이의 눈높이에서 아름답게 보여 줍니다.",
  "readAloud": "책을 읽으며 창밖의 나무나 낙엽을 함께 관찰하고, \"이 잎은 무슨 색이야?\" 하고 물어보세요!",
  "cover": {
   "emoji": "🍂",
   "palette": [
    "#C0392B",
    "#F0A500"
   ]
  },
  "quality": 0.88,
  "source": "curated"
 },
 {
  "id": "en-leaf-man-07eb",
  "lang": "en",
  "title": "Leaf Man",
  "author": "Lois Ehlert",
  "publisher": "",
  "isbn": "9780152053048",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "자연",
   "동물",
   "환상",
   "모험"
  ],
  "mood": [
   "잔잔한",
   "따뜻한"
  ],
  "blurb": "알록달록 단풍잎들로 만들어진 '잎사귀 인간'이 바람을 타고 세상을 여행하는 이야기로, 실제 낙엽 콜라주 삽화가 자연의 아름다움을 생생하게 담아냅니다.",
  "readAloud": "책을 읽기 전에 직접 나뭇잎을 모아 함께 인물이나 동물 모양을 만들어 보세요!",
  "cover": {
   "emoji": "🍂",
   "palette": [
    "#D2691E",
    "#F4A460"
   ]
  },
  "quality": 0.88,
  "source": "curated"
 },
 {
  "id": "en-the-napping-house-2f79",
  "lang": "en",
  "title": "The Napping House",
  "author": "Audrey Wood & Don Wood",
  "publisher": "",
  "isbn": "9780152567088",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "잠자리",
   "동물",
   "가족",
   "유머"
  ],
  "mood": [
   "웃긴",
   "잔잔한"
  ],
  "blurb": "비 내리는 날 할머니, 아이, 강아지, 고양이, 생쥐가 차례차례 포개어 낮잠을 자다가 작은 벼룩 한 마리에 의해 모두 와르르 깨어나는 유쾌한 이야기입니다.",
  "readAloud": "등장인물이 하나씩 쌓일 때마다 목소리를 낮추다가, 벼룩이 등장하는 순간 깜짝 큰 소리로 읽어 주세요!",
  "cover": {
   "emoji": "😴",
   "palette": [
    "#7bafd4",
    "#f5e6c8"
   ]
  },
  "quality": 0.95,
  "source": "curated"
 },
 {
  "id": "en-king-bidgood-s-in-the-bathtub-abf8",
  "lang": "en",
  "title": "King Bidgood's in the Bathtub",
  "author": "Audrey Wood & Don Wood",
  "publisher": "",
  "isbn": "9780152427306",
  "ages": [
   "3-4",
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "유머",
   "환상",
   "일상",
   "가족"
  ],
  "mood": [
   "웃긴",
   "따뜻한"
  ],
  "blurb": "목욕탕에서 절대 나오지 않으려는 왕 비그굿! 기사도, 왕비도, 요리사도 왕을 설득하지 못하는데, 과연 누가 이 엉뚱한 왕을 욕조 밖으로 끌어낼 수 있을까요?",
  "readAloud": "각 장면마다 \"누가 왕을 욕조에서 꺼낼까요?\" 라고 물으며 아이가 다음을 예측하게 해 보세요!",
  "cover": {
   "emoji": "🛁",
   "palette": [
    "#3B6FA0",
    "#F4C842"
   ]
  },
  "quality": 0.95,
  "source": "curated"
 },
 {
  "id": "en-quick-as-a-cricket-b2f6",
  "lang": "en",
  "title": "Quick as a Cricket",
  "author": "Audrey Wood & Don Wood",
  "publisher": "",
  "isbn": "9780859531511",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "동물",
   "감정",
   "일상"
  ],
  "mood": [
   "따뜻한",
   "웃긴"
  ],
  "blurb": "귀뚜라미처럼 빠르고, 달팽이처럼 느리고… 다양한 동물에 자신을 빗대며 \"나는 이런 사람이야!\"라고 당당하게 외치는 자기표현과 자존감의 그림책이에요.",
  "readAloud": "동물 이름이 나올 때마다 아이와 함께 그 동물의 움직임을 몸으로 흉내 내며 읽어보세요!",
  "cover": {
   "emoji": "🦗",
   "palette": [
    "#F9E04B",
    "#4A90D9"
   ]
  },
  "quality": 0.88,
  "source": "curated"
 },
 {
  "id": "en-the-little-mouse-the-red-ripe-st-45f2",
  "lang": "en",
  "title": "The Little Mouse, the Red Ripe Strawberry, and the Big Hungry Bear",
  "author": "Don Wood & Audrey Wood",
  "publisher": "",
  "isbn": "9780859530194",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "음식",
   "동물",
   "감정",
   "유머"
  ],
  "mood": [
   "웃긴",
   "따뜻한"
  ],
  "blurb": "작은 생쥐가 애써 딴 빨갛고 탐스러운 딸기를 배고픈 곰에게 빼앗기지 않으려고 안간힘을 쓰는 유쾌한 이야기로, 독자(화자)를 직접 끌어들이는 2인칭 서술이 읽는 재미를 두 배로 높여줍니다.",
  "readAloud": "화자가 아이에게 직접 말을 거는 장면에서 목소리를 낮추며 \"곰이 온대요, 쉿!\" 하고 속삭이듯 읽어주세요.",
  "cover": {
   "emoji": "🍓",
   "palette": [
    "#D72638",
    "#F5E6C8"
   ]
  },
  "quality": 0.88,
  "source": "curated"
 },
 {
  "id": "en-olivia-e56e",
  "lang": "en",
  "title": "Olivia",
  "author": "Ian Falconer",
  "publisher": "",
  "isbn": "9780689829536",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "동물",
   "일상",
   "감정",
   "유머"
  ],
  "mood": [
   "웃긴",
   "따뜻한"
  ],
  "blurb": "에너지 넘치는 꼬마 돼지 올리비아의 하루를 담은 책으로, 아이들이 자신만의 개성과 상상력을 마음껏 펼치는 모습을 유쾌하게 그려냅니다.",
  "readAloud": "올리비아가 \"지치게 만드는\" 장면에서 어른도 함께 과장된 표정을 지으며 읽으면 더 신나요!",
  "cover": {
   "emoji": "🐷",
   "palette": [
    "#E8474C",
    "#F5F0E8"
   ]
  },
  "quality": 0.97,
  "source": "curated"
 },
 {
  "id": "en-corduroy-17ba",
  "lang": "en",
  "title": "Corduroy",
  "author": "Don Freeman",
  "publisher": "",
  "isbn": "9780670241330",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "동물",
   "감정",
   "친구",
   "일상"
  ],
  "mood": [
   "따뜻한",
   "잔잔한"
  ],
  "blurb": "백화점 선반 위에 홀로 앉아 새 주인을 기다리는 곰 인형 코듀로이가 마침내 진심 어린 친구를 만나는 감동적인 이야기예요.",
  "readAloud": "코듀로이가 단추를 잃어버린 장면에서 아이에게 \"네가 가장 소중한 물건은 뭐야?\" 하고 물어보세요.",
  "cover": {
   "emoji": "🧸",
   "palette": [
    "#4B7A4A",
    "#F5C842"
   ]
  },
  "quality": 0.97,
  "source": "curated"
 },
 {
  "id": "en-a-pocket-for-corduroy-912d",
  "lang": "en",
  "title": "A Pocket for Corduroy",
  "author": "Don Freeman",
  "publisher": "",
  "isbn": "9780670557431",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "가족",
   "친구",
   "감정",
   "일상"
  ],
  "mood": [
   "따뜻한",
   "모험"
  ],
  "blurb": "곰 인형 코듀로이가 자신만의 주머니를 찾아 세탁소를 탐험하는 이야기로, 소중한 친구와의 유대감을 따뜻하게 담아냈어요.",
  "readAloud": "코듀로이가 주머니를 찾을 때마다 \"여기 있을까?\" 하고 아이와 함께 두근두근 찾아보세요!",
  "cover": {
   "emoji": "🧸",
   "palette": [
    "#5B8CDB",
    "#F4C842"
   ]
  },
  "quality": 0.88,
  "source": "curated"
 },
 {
  "id": "en-caps-for-sale-82ff",
  "lang": "en",
  "title": "Caps for Sale",
  "author": "Esphyr Slobodkina",
  "publisher": "",
  "isbn": "9780201091472",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "일상",
   "동물",
   "유머"
  ],
  "mood": [
   "웃긴",
   "따뜻한"
  ],
  "blurb": "모자 장수 아저씨가 나무 아래서 낮잠을 자는 사이, 원숭이들이 모자를 몽땅 훔쳐 달아나요! 과연 아저씨는 모자를 되찾을 수 있을까요?",
  "readAloud": "모자 색깔을 하나하나 큰 소리로 세어보고, 원숭이 흉내를 함께 내며 읽어보세요!",
  "cover": {
   "emoji": "🎩",
   "palette": [
    "#E8C07D",
    "#5B8CDB"
   ]
  },
  "quality": 0.95,
  "source": "curated"
 },
 {
  "id": "en-harold-and-the-purple-crayon-e576",
  "lang": "en",
  "title": "Harold and the Purple Crayon",
  "author": "Crockett Johnson",
  "publisher": "",
  "isbn": "9780060229351",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "환상",
   "모험",
   "그림그리기",
   "일상"
  ],
  "mood": [
   "잔잔한",
   "모험"
  ],
  "blurb": "보라색 크레파스 하나로 자신만의 세계를 그려 나가는 꼬마 해럴드의 이야기로, 상상력이 곧 세상을 만드는 힘임을 조용하고 따뜻하게 보여 줍니다.",
  "readAloud": "아이와 함께 \"다음엔 뭘 그릴까?\" 물어보며 이야기를 이어 가 보세요!",
  "cover": {
   "emoji": "🖍️",
   "palette": [
    "#7B4FA6",
    "#FFFFFF"
   ]
  },
  "quality": 0.97,
  "source": "curated"
 },
 {
  "id": "en-the-carrot-seed-c427",
  "lang": "en",
  "title": "The Carrot Seed",
  "author": "Ruth Krauss & Crockett Johnson",
  "publisher": "",
  "isbn": "9780064432108",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "자연",
   "가족",
   "감정",
   "음식"
  ],
  "mood": [
   "따뜻한",
   "잔잔한"
  ],
  "blurb": "아무도 자라지 않을 거라고 했지만, 꼬마 아이는 매일 씨앗에 물을 주고 돌봅니다. 믿음과 끈기가 결국 작은 씨앗을 거대한 당근으로 피워내는 잔잔하고 감동적인 이야기예요.",
  "readAloud": "\"안 자란다고 했잖아\" 부분에서 가족 목소리를 흉내 내며 읽고, 마지막 장면에서 아이와 함께 크게 \"짜잔!\" 하고 외쳐 보세요.",
  "cover": {
   "emoji": "🥕",
   "palette": [
    "#F97316",
    "#A3C97A"
   ]
  },
  "quality": 0.95,
  "source": "curated"
 },
 {
  "id": "en-if-you-give-a-mouse-a-cookie-261a",
  "lang": "en",
  "title": "If You Give a Mouse a Cookie",
  "author": "Laura Numeroff & Felicia Bond",
  "publisher": "",
  "isbn": "9780060245863",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "음식",
   "동물",
   "일상",
   "유머"
  ],
  "mood": [
   "웃긴",
   "따뜻한"
  ],
  "blurb": "쿠키 하나를 준 것뿐인데… 꼬리에 꼬리를 무는 생쥐의 끝없는 요구가 유쾌하고 사랑스럽습니다!",
  "readAloud": "생쥐가 무언가를 요구할 때마다 \"그 다음엔 뭘 달라고 할까?\" 하고 아이에게 먼저 예측하게 해 보세요.",
  "cover": {
   "emoji": "🍪",
   "palette": [
    "#F5C842",
    "#FFFFFF"
   ]
  },
  "quality": 0.97,
  "source": "curated"
 },
 {
  "id": "en-the-runaway-bunny-22b0",
  "lang": "en",
  "title": "The Runaway Bunny",
  "author": "Margaret Wise Brown & Clement Hurd",
  "publisher": "",
  "isbn": "9780060775827",
  "ages": [
   "0-2",
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "가족",
   "동물",
   "환상",
   "감정"
  ],
  "mood": [
   "따뜻한",
   "잔잔한"
  ],
  "blurb": "아기 토끼가 엄마를 떠나 도망가려 해도, 엄마 토끼는 어떤 모습으로든 늘 곁에 있겠다고 다독여 주는 사랑스러운 이야기입니다. 변함없는 엄마의 사랑을 포근하게 느낄 수 있어요.",
  "readAloud": "엄마 역할과 아기 토끼 역할을 나눠 읽으면 아이가 엄마의 사랑을 더욱 생생하게 느낄 수 있어요.",
  "cover": {
   "emoji": "🐰",
   "palette": [
    "#a8d8a8",
    "#f9f3e3"
   ]
  },
  "quality": 0.97,
  "source": "curated"
 },
 {
  "id": "en-the-important-book-1e9d",
  "lang": "en",
  "title": "The Important Book",
  "author": "Margaret Wise Brown",
  "publisher": "",
  "isbn": "9780060207205",
  "ages": [
   "3-4",
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "일상",
   "자연",
   "감정"
  ],
  "mood": [
   "잔잔한",
   "학습"
  ],
  "blurb": "숟가락, 사과, 비, 눈송이… 우리 주변의 평범한 사물들에서 가장 중요한 것이 무엇인지 반복되는 리듬으로 찬찬히 짚어주는 책이에요. 아이가 세상을 관찰하고 스스로 생각하는 힘을 키워줍니다.",
  "readAloud": "\"The important thing about _____ is…\" 문장 패턴을 함께 읽고, 책을 덮은 뒤 아이가 좋아하는 물건을 골라 직접 \"중요한 것\"을 말해보게 해 보세요!",
  "cover": {
   "emoji": "🌿",
   "palette": [
    "#F5E6C8",
    "#7BAF7B"
   ]
  },
  "quality": 0.85,
  "source": "curated"
 },
 {
  "id": "en-big-red-barn-caeb",
  "lang": "en",
  "title": "Big Red Barn",
  "author": "Margaret Wise Brown",
  "publisher": "",
  "isbn": "9780060207489",
  "ages": [
   "0-2",
   "3-4"
  ],
  "level": "보드북",
  "themes": [
   "동물",
   "자연",
   "일상"
  ],
  "mood": [
   "잔잔한",
   "따뜻한"
  ],
  "blurb": "빨간 헛간 안팎에 사는 다양한 농장 동물들의 하루를 포근하게 담아낸 그림책으로, 반복되는 리듬감 있는 글이 어린 아이의 귀를 즐겁게 합니다.",
  "readAloud": "각 동물이 나올 때마다 울음소리를 함께 흉내 내며 읽어 주세요!",
  "cover": {
   "emoji": "🐄",
   "palette": [
    "#C0392B",
    "#F9E4B7"
   ]
  },
  "quality": 0.88,
  "source": "curated"
 },
 {
  "id": "en-stellaluna-3772",
  "lang": "en",
  "title": "Stellaluna",
  "author": "Janell Cannon",
  "publisher": "",
  "isbn": "9780152802172",
  "ages": [
   "3-4",
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "동물",
   "가족",
   "친구",
   "자연"
  ],
  "mood": [
   "따뜻한",
   "모험"
  ],
  "blurb": "엄마를 잃고 새 둥지에서 자란 아기 박쥐 스텔라루나가 자신이 누구인지 찾아가는 따뜻하고 감동적인 이야기예요.",
  "readAloud": "박쥐와 새의 다른 점을 아이와 함께 찾아보며 \"달라도 친구가 될 수 있어요!\" 라고 이야기 나눠 보세요.",
  "cover": {
   "emoji": "🦇",
   "palette": [
    "#1B2A4A",
    "#F5A623"
   ]
  },
  "quality": 0.93,
  "source": "curated"
 },
 {
  "id": "en-the-kissing-hand-0201",
  "lang": "en",
  "title": "The Kissing Hand",
  "author": "Audrey Penn",
  "publisher": "",
  "isbn": "9781933718026",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "가족",
   "감정",
   "동물",
   "일상"
  ],
  "mood": [
   "따뜻한",
   "잔잔한"
  ],
  "blurb": "학교에 처음 가는 것이 무서운 아기 너구리 체스터에게 엄마가 특별한 비밀을 알려줘요. 손바닥에 새겨진 엄마의 사랑이 언제 어디서든 함께한다는 것을요.",
  "readAloud": "아이의 손바닥에 직접 뽀뽀하며 읽어 주면 이야기 속 사랑이 현실로 전해져요.",
  "cover": {
   "emoji": "🦝",
   "palette": [
    "#7B3F00",
    "#F5E6CA"
   ]
  },
  "quality": 0.92,
  "source": "curated"
 },
 {
  "id": "en-click-clack-moo-cows-that-type-2b9e",
  "lang": "en",
  "title": "Click, Clack, Moo: Cows That Type",
  "author": "Doreen Cronin & Betsy Lewin",
  "publisher": "",
  "isbn": "9780689832130",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "동물",
   "유머",
   "일상",
   "감정"
  ],
  "mood": [
   "웃긴",
   "따뜻한"
  ],
  "blurb": "농장의 소들이 타자기로 편지를 써서 농부 아저씨에게 요구사항을 전달한다는 엉뚱하고 유쾌한 이야기로, 협상과 의사소통의 즐거움을 담고 있어요.",
  "readAloud": "타자기 소리 \"딸깍, 딸깍, 음매~\"를 함께 리듬감 있게 따라 읽으며 소들의 목소리를 흉내 내 보세요!",
  "cover": {
   "emoji": "🐄",
   "palette": [
    "#E8C97A",
    "#5B8A5F"
   ]
  },
  "quality": 0.95,
  "source": "curated"
 },
 {
  "id": "en-duck-on-a-bike-50af",
  "lang": "en",
  "title": "Duck on a Bike",
  "author": "David Shannon",
  "publisher": "",
  "isbn": "9780439050234",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "동물",
   "탈것",
   "유머",
   "일상"
  ],
  "mood": [
   "웃긴",
   "모험"
  ],
  "blurb": "오리가 자전거를 타기 시작하자 농장 동물 친구들이 모두 깜짝 놀라요! 엉뚱하고 유쾌한 오리의 자전거 모험이 아이들에게 큰 웃음을 선사합니다.",
  "readAloud": "각 동물이 등장할 때마다 그 동물의 소리를 내며 읽어 주면 아이들이 더욱 신나게 참여해요!",
  "cover": {
   "emoji": "🦆",
   "palette": [
    "#5DADE2",
    "#F9E79F"
   ]
  },
  "quality": 0.88,
  "source": "curated"
 },
 {
  "id": "en-no-david-4890",
  "lang": "en",
  "title": "No, David!",
  "author": "David Shannon",
  "publisher": "",
  "isbn": "9780590930024",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "일상",
   "감정",
   "가족",
   "유머"
  ],
  "mood": [
   "웃긴",
   "따뜻한"
  ],
  "blurb": "엄마한테 맨날 \"안 돼, 데이빗!\"을 듣는 개구쟁이 소년의 좌충우돌 일상을 담은 책으로, 마지막 장면의 따뜻한 포옹이 아이와 어른 모두의 마음을 울립니다.",
  "readAloud": "\"안 돼, 데이빗!\" 장면마다 아이와 함께 큰 소리로 외쳐보고, 왜 안 되는지 이야기 나눠보세요.",
  "cover": {
   "emoji": "🙅",
   "palette": [
    "#E83B2A",
    "#F5E6C8"
   ]
  },
  "quality": 0.97,
  "source": "curated"
 },
 {
  "id": "en-a-bad-case-of-stripes-5924",
  "lang": "en",
  "title": "A Bad Case of Stripes",
  "author": "David Shannon",
  "publisher": "",
  "isbn": "9780590929974",
  "ages": [
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "감정",
   "일상",
   "환상",
   "친구"
  ],
  "mood": [
   "웃긴",
   "따뜻한"
  ],
  "blurb": "남들 눈치만 보다가 온몸에 줄무늬가 생겨버린 카밀라 이야기로, '나답게 사는 것'의 소중함을 유쾌하게 전한다.",
  "readAloud": "책을 읽으며 아이에게 \"카밀라처럼 남들 눈치를 봤던 적 있어?\"라고 물어보세요.",
  "cover": {
   "emoji": "🌈",
   "palette": [
    "#E63946",
    "#F4D35E"
   ]
  },
  "quality": 0.9,
  "source": "curated"
 },
 {
  "id": "en-the-three-snow-bears-7983",
  "lang": "en",
  "title": "The Three Snow Bears",
  "author": "Jan Brett",
  "publisher": "",
  "isbn": "9780399247927",
  "ages": [
   "3-4",
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "환상",
   "동물",
   "모험",
   "가족"
  ],
  "mood": [
   "따뜻한",
   "모험"
  ],
  "blurb": "북극을 배경으로 한 「곰 세 마리」의 환상적인 리텔링! 이누이트 소녀 아룩이 눈 덮인 세 마리 북극곰의 집에서 펼치는 신나는 모험이 Jan Brett 특유의 섬세하고 화려한 그림으로 펼쳐집니다.",
  "readAloud": "각 페이지 테두리에 숨겨진 북극곰 가족의 움직임을 아이와 함께 손으로 짚어가며 읽어 보세요!",
  "cover": {
   "emoji": "🐻‍❄️",
   "palette": [
    "#A8D8EA",
    "#FFFFFF"
   ]
  },
  "quality": 0.85,
  "source": "curated"
 },
 {
  "id": "en-where-s-spot-e8f7",
  "lang": "en",
  "title": "Where's Spot?",
  "author": "Eric Hill",
  "publisher": "",
  "isbn": "9780723263494",
  "ages": [
   "0-2",
   "3-4"
  ],
  "level": "보드북",
  "themes": [
   "동물",
   "일상",
   "가족"
  ],
  "mood": [
   "따뜻한",
   "웃긴"
  ],
  "blurb": "엄마 개 샐리가 아기 강아지 스팟을 찾아 집 안 곳곳을 뒤지는 숨바꼭질 이야기로, 플랩을 들출 때마다 깜짝 친구들이 나타나 아이들을 즐겁게 해줍니다.",
  "readAloud": "플랩을 들추기 전에 \"여기 있을까?\" 하고 아이에게 먼저 물어보세요!",
  "cover": {
   "emoji": "🐶",
   "palette": [
    "#F5C842",
    "#FFFFFF"
   ]
  },
  "quality": 0.97,
  "source": "curated"
 },
 {
  "id": "en-maisy-goes-to-the-library-a0af",
  "lang": "en",
  "title": "Maisy Goes to the Library",
  "author": "Lucy Cousins",
  "publisher": "",
  "isbn": "9780763622565",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "일상",
   "동물",
   "친구"
  ],
  "mood": [
   "따뜻한",
   "잔잔한"
  ],
  "blurb": "사랑스러운 생쥐 메이지가 도서관에 가서 책을 고르고 친구들과 즐거운 시간을 보내는 이야기로, 아이들에게 도서관과 독서의 즐거움을 자연스럽게 알려줘요.",
  "readAloud": "책 속에 나오는 여러 종류의 책 이름을 짚어 가며, \"어떤 책을 빌리고 싶어?\" 하고 아이에게 물어보세요!",
  "cover": {
   "emoji": "📚",
   "palette": [
    "#F9E04B",
    "#5BB5E0"
   ]
  },
  "quality": 0.82,
  "source": "curated"
 },
 {
  "id": "en-tabby-mctat-8036",
  "lang": "en",
  "title": "Tabby McTat",
  "author": "Julia Donaldson & Axel Scheffler",
  "publisher": "",
  "isbn": "9781407109657",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "동물",
   "친구",
   "가족",
   "일상"
  ],
  "mood": [
   "따뜻한",
   "웃긴"
  ],
  "blurb": "길거리 음악가 프레드와 함께 노래하던 줄무늬 고양이 태비 맥탯이 주인과 헤어진 뒤 새 가족을 찾고 다시 만나는 이야기로, 우정과 가족의 소중함을 따뜻하게 담아냅니다.",
  "readAloud": "태비 맥탯의 \"야옹\" 소리가 나올 때마다 아이와 함께 고양이 목소리로 크게 따라 읽어보세요!",
  "cover": {
   "emoji": "🐱",
   "palette": [
    "#F4A832",
    "#4A7BB5"
   ]
  },
  "quality": 0.88,
  "source": "curated"
 },
 {
  "id": "en-the-highway-rat-09fd",
  "lang": "en",
  "title": "The Highway Rat",
  "author": "Julia Donaldson & Axel Scheffler",
  "publisher": "",
  "isbn": "9781407139173",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "모험",
   "동물",
   "유머",
   "환상"
  ],
  "mood": [
   "웃긴",
   "모험"
  ],
  "blurb": "길을 지나는 동물들의 먹을 것을 빼앗는 못된 쥐 도둑의 이야기로, 통통 튀는 운율과 통쾌한 결말이 아이들을 단숨에 사로잡아요!",
  "readAloud": "쥐 도둑이 먹을 것을 빼앗는 장면마다 목소리를 높여 읽어 주고, \"Give me your buns!\"를 함께 외쳐 보세요.",
  "cover": {
   "emoji": "🐀",
   "palette": [
    "#2E4A1E",
    "#D4A017"
   ]
  },
  "quality": 0.85,
  "source": "curated"
 },
 {
  "id": "en-a-squash-and-a-squeeze-d7c6",
  "lang": "en",
  "title": "A Squash and a Squeeze",
  "author": "Julia Donaldson & Axel Scheffler",
  "publisher": "",
  "isbn": "9780333903841",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "동물",
   "일상",
   "유머",
   "가족"
  ],
  "mood": [
   "웃긴",
   "따뜻한"
  ],
  "blurb": "좁은 집이 불만인 할머니가 현자의 말대로 동물들을 하나씩 들였다 내보내며 결국 \"원래 집이 최고!\"라는 깨달음을 얻는 유쾌한 이야기예요.",
  "readAloud": "동물이 하나씩 들어올 때마다 목소리를 달리 해보고, 할머니의 투덜거리는 목소리를 과장되게 표현하면 아이들이 더 좋아해요!",
  "cover": {
   "emoji": "🐔",
   "palette": [
    "#F5C842",
    "#7DBF6E"
   ]
  },
  "quality": 0.88,
  "source": "curated"
 },
 {
  "id": "en-charlie-cook-s-favourite-book-95cd",
  "lang": "en",
  "title": "Charlie Cook's Favourite Book",
  "author": "Julia Donaldson & Axel Scheffler",
  "publisher": "",
  "isbn": "9781405021258",
  "ages": [
   "3-4",
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "환상",
   "모험",
   "친구",
   "유머"
  ],
  "mood": [
   "웃긴",
   "모험"
  ],
  "blurb": "찰리 쿡이 읽는 책 속에 또 책이 있고, 그 책 속에 또 책이 있는 '이야기 속 이야기' 구조로, 독자를 유쾌한 상상의 미로 속으로 빠져들게 합니다. 줄리아 도널드슨 특유의 신나는 라임과 액셀 셰플러의 생동감 넘치는 그림이 책 읽기의 즐거움 자체를 주제로 담아낸 작품입니다.",
  "readAloud": "각 이야기가 바뀔 때마다 목소리 톤을 달리해 읽어 주면 아이가 '이야기 속 이야기' 구조를 훨씬 재미있게 느낄 수 있어요!",
  "cover": {
   "emoji": "📚",
   "palette": [
    "#E8412B",
    "#F5C842"
   ]
  },
  "quality": 0.88,
  "source": "curated"
 },
 {
  "id": "en-the-smartest-giant-in-town-c28f",
  "lang": "en",
  "title": "The Smartest Giant in Town",
  "author": "Julia Donaldson & Axel Scheffler",
  "publisher": "",
  "isbn": "9780333961216",
  "ages": [
   "3-4",
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "친구",
   "일상",
   "동물",
   "감정"
  ],
  "mood": [
   "따뜻한",
   "웃긴"
  ],
  "blurb": "옷을 새로 사서 멋쟁이가 되고 싶었던 거인 조지, 하지만 도움이 필요한 동물 친구들을 만날 때마다 자신의 새 옷을 하나씩 나눠 주고 맙니다. 나눔과 친절이 얼마나 큰 기쁨을 가져다주는지 따뜻하게 일깨워 주는 이야기예요.",
  "readAloud": "조지가 옷을 벗어 줄 때마다 \"과연 다음엔 누구를 도와줄까?\" 하고 아이에게 먼저 물어보세요!",
  "cover": {
   "emoji": "🧣",
   "palette": [
    "#E8A838",
    "#4A90A4"
   ]
  },
  "quality": 0.9,
  "source": "curated"
 },
 {
  "id": "en-superworm-324b",
  "lang": "en",
  "title": "Superworm",
  "author": "Julia Donaldson & Axel Scheffler",
  "publisher": "",
  "isbn": "9781407137766",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "동물",
   "모험",
   "환상",
   "친구"
  ],
  "mood": [
   "웃긴",
   "따뜻한"
  ],
  "blurb": "슈퍼지렁이는 친구들을 위해 무엇이든 해주는 영웅이지만, 어느 날 사악한 마법사 도마뱀에게 붙잡히고 마는데—과연 친구들이 슈퍼지렁이를 구해낼 수 있을까요?",
  "readAloud": "\"Super-worm, super-worm…\" 반복되는 리듬감 있는 구절을 아이와 함께 크게 따라 읽어 보세요!",
  "cover": {
   "emoji": "🪱",
   "palette": [
    "#4CAF50",
    "#FFF176"
   ]
  },
  "quality": 0.88,
  "source": "curated"
 },
 {
  "id": "en-what-the-ladybird-heard-7c3b",
  "lang": "en",
  "title": "What the Ladybird Heard",
  "author": "Julia Donaldson & Lydia Monks",
  "publisher": "",
  "isbn": "9780230704930",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "동물",
   "모험",
   "일상",
   "유머"
  ],
  "mood": [
   "웃긴",
   "따뜻한"
  ],
  "blurb": "말 못 하는 무당벌레가 농장 동물들을 도둑으로부터 구해내는 유쾌하고 따뜻한 이야기로, 작고 조용한 존재도 큰 힘을 발휘할 수 있다는 것을 보여줘요.",
  "readAloud": "농장 동물들의 울음소리를 아이와 함께 흉내 내며 읽으면 더욱 신나게 즐길 수 있어요!",
  "cover": {
   "emoji": "🐞",
   "palette": [
    "#E8334A",
    "#F5E642"
   ]
  },
  "quality": 0.88,
  "source": "curated"
 },
 {
  "id": "en-millions-of-cats-2d62",
  "lang": "en",
  "title": "Millions of Cats",
  "author": "Wanda Gág",
  "publisher": "",
  "isbn": "9780698113633",
  "ages": [
   "3-4",
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "동물",
   "가족",
   "감정",
   "유머"
  ],
  "mood": [
   "웃긴",
   "따뜻한"
  ],
  "blurb": "수백만, 수십억, 수조 마리의 고양이 중에서 딱 한 마리를 고르려는 할아버지의 좌충우돌 이야기로, 욕심과 선택의 의미를 재치 있게 담아낸 그림책의 고전입니다.",
  "readAloud": "\"hundreds of cats, thousands of cats, millions and billions and trillions of cats!\" 구절을 아이와 함께 리듬감 있게 따라 읽어 보세요!",
  "cover": {
   "emoji": "🐱",
   "palette": [
    "#F5E6C8",
    "#4A7C59"
   ]
  },
  "quality": 0.97,
  "source": "curated"
 },
 {
  "id": "en-the-tale-of-the-flopsy-bunnies-f32c",
  "lang": "en",
  "title": "The Tale of the Flopsy Bunnies",
  "author": "Beatrix Potter",
  "publisher": "",
  "isbn": "9780723247791",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "동물",
   "가족",
   "모험",
   "자연"
  ],
  "mood": [
   "따뜻한",
   "잔잔한"
  ],
  "blurb": "피터 래빗의 형제들인 플롭시 토끼 가족이 맥그리거 아저씨의 채소밭에서 겪는 아슬아슬한 모험을 담은 베아트릭스 포터의 사랑스러운 고전입니다. 위험 속에서도 가족이 서로를 구해내는 따뜻한 이야기가 펼쳐집니다.",
  "readAloud": "토끼들이 깜빡 잠드는 장면에서 목소리를 낮추고 천천히 읽어 주면 아이가 긴장감을 더 실감 나게 느낄 수 있어요.",
  "cover": {
   "emoji": "🐰",
   "palette": [
    "#7dab6e",
    "#f5e6c8"
   ]
  },
  "quality": 0.92,
  "source": "curated"
 },
 {
  "id": "en-frog-and-toad-are-friends-280d",
  "lang": "en",
  "title": "Frog and Toad Are Friends",
  "author": "Arnold Lobel",
  "publisher": "",
  "isbn": "9780064440202",
  "ages": [
   "5-6",
   "7-9"
  ],
  "level": "초기챕터북",
  "themes": [
   "친구",
   "동물",
   "일상",
   "감정"
  ],
  "mood": [
   "따뜻한",
   "웃긴"
  ],
  "blurb": "개구리와 두꺼비, 성격은 달라도 서로를 아끼는 두 친구의 다섯 가지 이야기가 담겨 있어요. 진짜 우정이란 무엇인지 잔잔하고 따뜻하게 느끼게 해주는 책이에요.",
  "readAloud": "두 캐릭터의 목소리를 달리 해서 읽어 주면 아이가 더 재미있게 몰입할 수 있어요!",
  "cover": {
   "emoji": "🐸",
   "palette": [
    "#6BAF6B",
    "#A0522D"
   ]
  },
  "quality": 0.97,
  "source": "curated"
 },
 {
  "id": "en-frog-and-toad-together-a710",
  "lang": "en",
  "title": "Frog and Toad Together",
  "author": "Arnold Lobel",
  "publisher": "",
  "isbn": "9780064440219",
  "ages": [
   "5-6",
   "7-9"
  ],
  "level": "초기챕터북",
  "themes": [
   "친구",
   "감정",
   "일상",
   "자연"
  ],
  "mood": [
   "따뜻한",
   "웃긴"
  ],
  "blurb": "개구리와 두꺼비, 성격은 달라도 언제나 함께하는 두 친구의 일상을 담은 다섯 편의 따뜻한 이야기예요. 진정한 우정이 무엇인지 자연스럽게 느끼게 해주는 고전 명작입니다.",
  "readAloud": "두 친구의 대화를 개구리(밝고 씩씩하게)와 두꺼비(느릿하고 투덜거리는 목소리)로 구분해 읽어 주면 아이가 더 즐거워해요!",
  "cover": {
   "emoji": "🐸",
   "palette": [
    "#6AAF3D",
    "#A0522D"
   ]
  },
  "quality": 0.98,
  "source": "curated"
 },
 {
  "id": "en-fables-918a",
  "lang": "en",
  "title": "Fables",
  "author": "Arnold Lobel",
  "publisher": "",
  "isbn": "9780064430463",
  "ages": [
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "동물",
   "유머",
   "감정",
   "일상"
  ],
  "mood": [
   "웃긴",
   "따뜻한"
  ],
  "blurb": "악어, 원숭이, 돼지 등 개성 넘치는 동물들이 펼치는 짧고 기발한 20편의 우화 — 각 이야기 끝에 담긴 재치 있는 교훈이 어른과 아이 모두를 미소 짓게 합니다.",
  "readAloud": "각 이야기를 읽은 뒤 \"이 동물은 왜 그랬을까?\" 하고 아이에게 교훈을 직접 말해보게 해 보세요.",
  "cover": {
   "emoji": "🦊",
   "palette": [
    "#D4A843",
    "#4A7C3F"
   ]
  },
  "quality": 0.95,
  "source": "curated"
 },
 {
  "id": "en-are-you-my-mother-0fe2",
  "lang": "en",
  "title": "Are You My Mother?",
  "author": "P. D. Eastman",
  "publisher": "",
  "isbn": "9780394800189",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "동물",
   "가족",
   "모험"
  ],
  "mood": [
   "따뜻한",
   "모험"
  ],
  "blurb": "알에서 깨어난 아기 새가 엄마를 찾아 고양이, 개, 자동차, 굴착기까지 차례로 물어보는 이야기로, '넌 내 엄마니?'라는 반복 질문이 아이의 마음을 사로잡아요.",
  "readAloud": "각 장면마다 아이와 함께 \"넌 내 엄마야?\"를 번갈아 외치고, 마지막 재회 장면에서 꼭 안아 주세요!",
  "cover": {
   "emoji": "🐣",
   "palette": [
    "#F5C842",
    "#5B9BD5"
   ]
  },
  "quality": 0.92,
  "source": "curated"
 },
 {
  "id": "en-go-dog-go-8d00",
  "lang": "en",
  "title": "Go, Dog. Go!",
  "author": "P. D. Eastman",
  "publisher": "",
  "isbn": "9780394800202",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "탈것",
   "동물",
   "일상"
  ],
  "mood": [
   "웃긴",
   "모험"
  ],
  "blurb": "알록달록 강아지들이 자동차를 타고 신나게 달리는 이야기로, 반복되는 문장과 유쾌한 그림이 아이들의 첫 영어 읽기를 이끌어 줍니다.",
  "readAloud": "\"Go, dog. Go!\" 대사가 나올 때마다 아이와 함께 신나게 외쳐 보세요!",
  "cover": {
   "emoji": "🐕",
   "palette": [
    "#E83B2A",
    "#F5C842"
   ]
  },
  "quality": 0.9,
  "source": "curated"
 },
 {
  "id": "en-curious-george-aeba",
  "lang": "en",
  "title": "Curious George",
  "author": "H. A. Rey",
  "publisher": "",
  "isbn": "9780395150238",
  "ages": [
   "3-4",
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "동물",
   "모험",
   "유머",
   "일상"
  ],
  "mood": [
   "웃긴",
   "모험"
  ],
  "blurb": "호기심 많은 꼬마 원숭이 조지가 노란 모자 아저씨와 함께 도시에서 벌이는 좌충우돌 소동을 담은 사랑받는 고전 그림책이에요.",
  "readAloud": "조지가 사고를 칠 때마다 \"어머, 왜 그랬을까?\" 하고 아이와 함께 이유를 상상해 보세요!",
  "cover": {
   "emoji": "🐵",
   "palette": [
    "#F5C518",
    "#5B3A29"
   ]
  },
  "quality": 0.97,
  "source": "curated"
 },
 {
  "id": "en-mike-mulligan-and-his-steam-shov-a205",
  "lang": "en",
  "title": "Mike Mulligan and His Steam Shovel",
  "author": "Virginia Lee Burton",
  "publisher": "",
  "isbn": "9780395169612",
  "ages": [
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "탈것",
   "일상",
   "모험"
  ],
  "mood": [
   "따뜻한",
   "모험"
  ],
  "blurb": "낡은 증기 굴착기 메리 앤과 마이크가 새 기계들에 밀려나면서도 포기하지 않고 마지막 도전에 나서는, 우정과 끈기의 이야기입니다.",
  "readAloud": "굴착기가 땅을 파는 장면에서 \"쾅쾅! 퍼퍼퍼!\" 소리를 함께 흉내 내며 읽어 주세요!",
  "cover": {
   "emoji": "🚜",
   "palette": [
    "#D94E2B",
    "#4A7C59"
   ]
  },
  "quality": 0.93,
  "source": "curated"
 },
 {
  "id": "en-the-little-house-f54b",
  "lang": "en",
  "title": "The Little House",
  "author": "Virginia Lee Burton",
  "publisher": "",
  "isbn": "9780395181560",
  "ages": [
   "3-4",
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "일상",
   "자연",
   "가족",
   "환상"
  ],
  "mood": [
   "잔잔한",
   "따뜻한"
  ],
  "blurb": "시골의 작은 집이 도시화의 물결 속에 변해가는 세상을 바라보며 고향을 그리워하는 이야기로, 변화와 자연, 삶의 터전에 대한 깊은 울림을 줍니다.",
  "readAloud": "계절이 바뀌는 장면마다 잠깐 멈추고 \"지금은 어떤 계절일까? 집은 어떤 기분일까?\" 하고 아이에게 물어보세요.",
  "cover": {
   "emoji": "🏡",
   "palette": [
    "#E8C87A",
    "#4A7C59"
   ]
  },
  "quality": 0.95,
  "source": "curated"
 },
 {
  "id": "en-the-story-of-ferdinand-298a",
  "lang": "en",
  "title": "The Story of Ferdinand",
  "author": "Munro Leaf & Robert Lawson",
  "publisher": "",
  "isbn": "9780448456942",
  "ages": [
   "3-4",
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "동물",
   "자연",
   "감정",
   "일상"
  ],
  "mood": [
   "잔잔한",
   "따뜻한"
  ],
  "blurb": "싸우기 싫고 꽃향기 맡는 걸 좋아하는 황소 페르디난드 이야기로, 자신만의 방식으로 살아가는 것이 얼마나 소중한지를 부드럽게 전해줍니다.",
  "readAloud": "페르디난드가 꽃밭에 앉는 장면에서 잠깐 멈추고 \"너는 어떤 것을 좋아해?\" 하고 아이에게 물어보세요.",
  "cover": {
   "emoji": "🌸",
   "palette": [
    "#4a7c3f",
    "#f5e6c8"
   ]
  },
  "quality": 0.97,
  "source": "curated"
 },
 {
  "id": "en-harry-the-dirty-dog-6a4a",
  "lang": "en",
  "title": "Harry the Dirty Dog",
  "author": "Gene Zion & Margaret Bloy Graham",
  "publisher": "",
  "isbn": "9780064430098",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "동물",
   "일상",
   "가족"
  ],
  "mood": [
   "웃긴",
   "따뜻한"
  ],
  "blurb": "목욕이 싫어서 도망친 흰 강아지 해리가 온 동네를 돌아다니다 새까맣게 변해 집으로 돌아오는 이야기로, 가족의 따뜻한 사랑을 유머러스하게 담았어요.",
  "readAloud": "해리가 더러워지는 장면마다 \"어머, 이제 몇 군데나 더러워졌지?\" 하며 아이와 함께 세어 보세요!",
  "cover": {
   "emoji": "🐶",
   "palette": [
    "#FFFFFF",
    "#2C2C2C"
   ]
  },
  "quality": 0.92,
  "source": "curated"
 },
 {
  "id": "en-a-chair-for-my-mother-6916",
  "lang": "en",
  "title": "A Chair for My Mother",
  "author": "Vera B. Williams",
  "publisher": "",
  "isbn": "9780688040741",
  "ages": [
   "3-4",
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "가족",
   "일상",
   "감정"
  ],
  "mood": [
   "따뜻한",
   "잔잔한"
  ],
  "blurb": "화재로 집을 잃은 가족이 한 푼 두 푼 동전을 모아 엄마를 위한 안락의자를 마련하는, 사랑과 희망이 담긴 이야기입니다.",
  "readAloud": "저금통에 동전을 넣는 장면에서 아이와 함께 \"우리 가족이라면 무엇을 모을까?\" 이야기 나눠 보세요.",
  "cover": {
   "emoji": "🪑",
   "palette": [
    "#E8513A",
    "#F9C74F"
   ]
  },
  "quality": 0.95,
  "source": "curated"
 },
 {
  "id": "en-alexander-and-the-terrible-horri-ff95",
  "lang": "en",
  "title": "Alexander and the Terrible, Horrible, No Good, Very Bad Day",
  "author": "Judith Viorst & Ray Cruz",
  "publisher": "",
  "isbn": "9780689711732",
  "ages": [
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "감정",
   "일상",
   "유머",
   "가족"
  ],
  "mood": [
   "웃긴",
   "따뜻한"
  ],
  "blurb": "아침에 일어나자마자 모든 것이 잘못되는 알렉산더의 최악의 하루! 누구나 한 번쯤 겪어봤을 엉망진창 하루를 유쾌하게 담아낸 공감 백배 그림책이다.",
  "readAloud": "아이가 최근에 속상했던 일을 떠올리며 \"나도 그런 날 있었어!\" 하고 이야기 나눠 보세요.",
  "cover": {
   "emoji": "😖",
   "palette": [
    "#F4A425",
    "#5B8CDB"
   ]
  },
  "quality": 0.97,
  "source": "curated"
 },
 {
  "id": "en-goodnight-goodnight-construction-01c4",
  "lang": "en",
  "title": "Goodnight, Goodnight, Construction Site",
  "author": "Sherri Duskey Rinker & Tom Lichtenheld",
  "publisher": "",
  "isbn": "9780811877824",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "탈것",
   "잠자리",
   "일상"
  ],
  "mood": [
   "따뜻한",
   "잔잔한"
  ],
  "blurb": "낮 동안 열심히 일한 굴착기, 덤프트럭, 크레인이 하나씩 엔진을 끄고 잠자리에 드는 모습을 담은 책으로, 탈것을 좋아하는 아이들의 취침 루틴을 다정하게 도와줍니다.",
  "readAloud": "각 차량 이름을 아이와 함께 따라 말하고, 마지막 페이지에서는 목소리를 점점 낮춰 속삭이듯 읽어 주세요.",
  "cover": {
   "emoji": "🚜",
   "palette": [
    "#E87B2F",
    "#1B3A5C"
   ]
  },
  "quality": 0.93,
  "source": "curated"
 },
 {
  "id": "en-dragons-love-tacos-864f",
  "lang": "en",
  "title": "Dragons Love Tacos",
  "author": "Adam Rubin & Daniel Salmieri",
  "publisher": "",
  "isbn": "9780803736801",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "환상",
   "음식",
   "유머",
   "동물"
  ],
  "mood": [
   "웃긴",
   "따뜻한"
  ],
  "blurb": "용들이 세상에서 가장 좋아하는 음식은 바로 타코! 단, 매운 살사는 절대 안 된다는 사실을 잊지 마세요. 유쾌하고 엉뚱한 상상력이 가득한 이야기입니다.",
  "readAloud": "\"용이 좋아하는 음식은 뭘까?\" 페이지마다 아이와 함께 타코 재료를 큰 소리로 외쳐 보세요!",
  "cover": {
   "emoji": "🐉",
   "palette": [
    "#E83B2A",
    "#2E7D32"
   ]
  },
  "quality": 0.92,
  "source": "curated"
 },
 {
  "id": "en-last-stop-on-market-street-8ce2",
  "lang": "en",
  "title": "Last Stop on Market Street",
  "author": "Matt de la Peña & Christian Robinson",
  "publisher": "",
  "isbn": "9780399257742",
  "ages": [
   "3-4",
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "가족",
   "일상",
   "감정",
   "친구"
  ],
  "mood": [
   "따뜻한",
   "잔잔한"
  ],
  "blurb": "버스를 타고 도시 끝 정류장까지 향하는 할머니와 손자 CJ의 이야기로, 가진 것에 감사하고 세상의 아름다움을 발견하는 법을 가르쳐 줍니다.",
  "readAloud": "버스 안 풍경을 함께 살펴보며 \"너라면 무엇이 아름답게 보여?\" 하고 아이에게 물어보세요.",
  "cover": {
   "emoji": "🚌",
   "palette": [
    "#4A90D9",
    "#F5A623"
   ]
  },
  "quality": 0.97,
  "source": "curated"
 },
 {
  "id": "en-journey-2b09",
  "lang": "en",
  "title": "Journey",
  "author": "Aaron Becker",
  "publisher": "",
  "isbn": "9780763660536",
  "ages": [
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "모험",
   "환상",
   "그림그리기",
   "감정"
  ],
  "mood": [
   "잔잔한",
   "모험"
  ],
  "blurb": "빨간 크레파스 하나로 그린 문이 현실이 되어 펼쳐지는, 말 한마디 없이도 마음을 가득 채우는 그림만의 모험 이야기입니다.",
  "readAloud": "다음 페이지를 펼치기 전, \"다음엔 어디로 갈 것 같아?\" 하고 아이에게 먼저 물어보세요.",
  "cover": {
   "emoji": "🖍️",
   "palette": [
    "#C0392B",
    "#1A1A2E"
   ]
  },
  "quality": 0.95,
  "source": "curated"
 },
 {
  "id": "en-first-the-egg-9af8",
  "lang": "en",
  "title": "First the Egg",
  "author": "Laura Vaccaro Seeger",
  "publisher": "",
  "isbn": "9781596432727",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "자연",
   "동물"
  ],
  "mood": [
   "잔잔한",
   "학습"
  ],
  "blurb": "달걀에서 닭이, 씨앗에서 꽃이, 애벌레에서 나비가 태어나는 변화의 순간을 간결하고 아름다운 컷아웃 일러스트로 담아낸 책이에요. 세상의 변화와 순서를 자연스럽게 익힐 수 있어요.",
  "readAloud": "각 페이지의 구멍(컷아웃)을 손가락으로 짚으며 \"다음엔 뭐가 될까?\" 하고 아이에게 먼저 물어보세요!",
  "cover": {
   "emoji": "🥚",
   "palette": [
    "#F5E6C8",
    "#7DB87A"
   ]
  },
  "quality": 0.92,
  "source": "curated"
 },
 {
  "id": "en-green-3b1d",
  "lang": "en",
  "title": "Green",
  "author": "Laura Vaccaro Seeger",
  "publisher": "",
  "isbn": "9781596433977",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "자연",
   "그림그리기",
   "감정"
  ],
  "mood": [
   "잔잔한",
   "학습"
  ],
  "blurb": "초록색 하나로 이토록 다양한 세상을 보여줄 수 있다니! 숲, 바다, 개구리, 잔디… 일상 속 '초록'의 수많은 얼굴을 아름다운 그림으로 만나보세요.",
  "readAloud": "각 장면마다 \"이건 어떤 초록색이야?\" 하고 물으며 아이가 직접 색을 묘사해 보도록 유도해 보세요.",
  "cover": {
   "emoji": "🌿",
   "palette": [
    "#4a7c59",
    "#d4e8c2"
   ]
  },
  "quality": 0.9,
  "source": "curated"
 },
 {
  "id": "en-mr-tiger-goes-wild-e8ce",
  "lang": "en",
  "title": "Mr. Tiger Goes Wild",
  "author": "Peter Brown",
  "publisher": "",
  "isbn": "9780316200639",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "동물",
   "감정",
   "일상",
   "환상"
  ],
  "mood": [
   "웃긴",
   "모험"
  ],
  "blurb": "점잖고 딱딱한 도시 생활에 지친 호랑이가 어느 날 본능을 따라 네 발로 뛰고 포효하며 진짜 자신을 찾아가는 유쾌한 이야기로, 개성과 자유를 마음껏 응원합니다.",
  "readAloud": "호랑이가 포효하는 장면에서 아이와 함께 \"으르렁!\" 소리를 내며 읽으면 더욱 신나요!",
  "cover": {
   "emoji": "🐯",
   "palette": [
    "#E8651A",
    "#2E4A1E"
   ]
  },
  "quality": 0.88,
  "source": "curated"
 },
 {
  "id": "en-the-dot-aaa0",
  "lang": "en",
  "title": "The Dot",
  "author": "Peter H. Reynolds",
  "publisher": "",
  "isbn": "9780763619619",
  "ages": [
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "그림그리기",
   "감정",
   "친구"
  ],
  "mood": [
   "따뜻한",
   "모험"
  ],
  "blurb": "그림을 못 그린다고 생각했던 베이티가 점 하나에서 시작해 자신만의 예술을 꽃피우는 이야기로, 자신감과 창의력이 얼마나 소중한지 따뜻하게 일깨워 줍니다.",
  "readAloud": "아이와 함께 책을 읽은 뒤 종이에 점을 하나 찍고 \"이 점으로 뭘 만들 수 있을까?\" 물어보세요!",
  "cover": {
   "emoji": "🔵",
   "palette": [
    "#1a3a6b",
    "#f5f0e8"
   ]
  },
  "quality": 0.95,
  "source": "curated"
 },
 {
  "id": "en-creepy-carrots-9fcf",
  "lang": "en",
  "title": "Creepy Carrots!",
  "author": "Aaron Reynolds & Peter Brown",
  "publisher": "",
  "isbn": "9781442402973",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "유머",
   "동물",
   "감정",
   "환상"
  ],
  "mood": [
   "웃긴",
   "모험"
  ],
  "blurb": "당근을 너무 좋아하는 토끼 재스퍼, 어느 날부터 당근들이 자신을 쫓아오는 것 같아 덜덜 떱니다! 상상력이 빚어낸 유쾌한 공포(?)를 흑백과 주황의 강렬한 그림으로 즐길 수 있어요.",
  "readAloud": "당근이 등장할 때마다 목소리를 낮추고 긴장감 있게 읽어 주면 아이들이 깔깔 웃어요!",
  "cover": {
   "emoji": "🥕",
   "palette": [
    "#E8601C",
    "#2B2B2B"
   ]
  },
  "quality": 0.93,
  "source": "curated"
 },
 {
  "id": "en-don-t-worry-little-crab-7d10",
  "lang": "en",
  "title": "Don't Worry, Little Crab",
  "author": "Chris Haughton",
  "publisher": "",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "감정",
   "동물",
   "가족",
   "모험"
  ],
  "mood": [
   "따뜻한",
   "모험"
  ],
  "blurb": "겁 많은 아기 게가 용기를 내어 큰 파도 속으로 뛰어드는 이야기로, 두려움을 이겨내는 따뜻한 성장을 담았어요.",
  "readAloud": "파도 소리를 흉내 내며 읽어 주면 아이가 더욱 생생하게 느낄 수 있어요!",
  "cover": {
   "emoji": "🦀",
   "palette": [
    "#1B6CA8",
    "#F4A828"
   ]
  },
  "quality": 0.82,
  "source": "curated"
 },
 {
  "id": "en-oh-no-george-372e",
  "lang": "en",
  "title": "Oh No, George!",
  "author": "Chris Haughton",
  "publisher": "",
  "isbn": "9781406326307",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "동물",
   "감정",
   "유머",
   "일상"
  ],
  "mood": [
   "웃긴",
   "따뜻한"
  ],
  "blurb": "주인이 외출한 사이, 강아지 조지는 케이크도 먹고 고양이도 쫓고…도저히 참을 수가 없어요! 실수를 해도 사랑받는 조지의 이야기로 충동 조절과 용서의 의미를 자연스럽게 배울 수 있어요.",
  "readAloud": "\"오, 노, 조지!\" 하는 장면마다 아이와 함께 과장된 목소리로 외쳐 보세요!",
  "cover": {
   "emoji": "🐶",
   "palette": [
    "#E83E2D",
    "#F5E6C8"
   ]
  },
  "quality": 0.88,
  "source": "curated"
 },
 {
  "id": "en-a-bit-lost-23c2",
  "lang": "en",
  "title": "A Bit Lost",
  "author": "Chris Haughton",
  "publisher": "",
  "isbn": "9781406322989",
  "ages": [
   "0-2",
   "3-4"
  ],
  "level": "보드북",
  "themes": [
   "동물",
   "가족",
   "감정",
   "환상"
  ],
  "mood": [
   "따뜻한",
   "잔잔한"
  ],
  "blurb": "나무에서 떨어진 아기 올빼미가 엄마를 찾아가는 이야기로, 숲 속 동물 친구들과의 귀여운 엇갈림이 아이 마음을 따뜻하게 감싸줍니다.",
  "readAloud": "동물들이 등장할 때마다 \"이게 엄마일까요?\" 하고 아이에게 물어보며 함께 맞혀보세요!",
  "cover": {
   "emoji": "🦉",
   "palette": [
    "#2E5D3B",
    "#F5A623"
   ]
  },
  "quality": 0.85,
  "source": "curated"
 },
 {
  "id": "en-goodnight-already-ff1c",
  "lang": "en",
  "title": "Goodnight Already!",
  "author": "Jory John & Benji Davies",
  "publisher": "",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "잠자리",
   "동물",
   "친구",
   "유머"
  ],
  "mood": [
   "웃긴",
   "따뜻한"
  ],
  "blurb": "잠들고 싶은 곰과 절대 잠 못 자는 오리의 좌충우돌 이웃 이야기—\"제발 이제 자자!\"를 외치는 곰의 심정에 아이들도 폭소를 터뜨릴 거예요.",
  "readAloud": "곰의 대사는 졸린 목소리로, 오리의 대사는 신나고 빠르게 읽어 대조를 살려 보세요!",
  "cover": {
   "emoji": "🐻",
   "palette": [
    "#4A90D9",
    "#F5E6C8"
   ]
  },
  "quality": 0.78,
  "source": "curated"
 },
 {
  "id": "en-the-bad-seed-69ce",
  "lang": "en",
  "title": "The Bad Seed",
  "author": "Jory John & Pete Oswald",
  "publisher": "",
  "isbn": "9780062467768",
  "ages": [
   "5-6",
   "7-9"
  ],
  "level": "그림책",
  "themes": [
   "감정",
   "유머",
   "일상",
   "친구"
  ],
  "mood": [
   "웃긴",
   "따뜻한"
  ],
  "blurb": "못된 씨앗이 왜 그렇게 삐딱해졌는지 솔직하게 털어놓으며, 누구나 변할 수 있다는 따뜻한 메시지를 유머 넘치게 전하는 책이에요.",
  "readAloud": "씨앗의 '나쁜 행동' 목록을 읽을 때 과장된 목소리로 읽어 주면 아이들이 더 깔깔 웃어요!",
  "cover": {
   "emoji": "🌱",
   "palette": [
    "#F5C518",
    "#3B2A1A"
   ]
  },
  "quality": 0.88,
  "source": "curated"
 },
 {
  "id": "en-the-storm-whale-06f3",
  "lang": "en",
  "title": "The Storm Whale",
  "author": "Benji Davies",
  "publisher": "",
  "isbn": "9781471115684",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "동물",
   "가족",
   "자연",
   "감정"
  ],
  "mood": [
   "따뜻한",
   "잔잔한"
  ],
  "blurb": "폭풍이 지나간 해변에서 작은 고래를 발견한 소년 노아의 짧지만 깊은 우정 이야기로, 자연과 이별, 가족의 따뜻함을 잔잔하게 담아냈어요.",
  "readAloud": "고래를 바다로 돌려보내는 장면에서 \"노아는 어떤 기분이었을까?\" 하고 아이에게 물어보세요.",
  "cover": {
   "emoji": "🐋",
   "palette": [
    "#4A7FB5",
    "#D9EAF7"
   ]
  },
  "quality": 0.88,
  "source": "curated"
 },
 {
  "id": "en-ten-little-fingers-and-ten-littl-b00d",
  "lang": "en",
  "title": "Ten Little Fingers and Ten Little Toes",
  "author": "Mem Fox & Helen Oxenbury",
  "publisher": "",
  "isbn": "9780152060572",
  "ages": [
   "0-2",
   "3-4"
  ],
  "level": "보드북",
  "themes": [
   "가족",
   "일상",
   "감정"
  ],
  "mood": [
   "따뜻한",
   "잔잔한"
  ],
  "blurb": "세상 곳곳에서 태어난 아기들이 모두 열 개의 손가락과 열 개의 발가락을 가졌다는 사실을 따뜻하게 노래하는 책이에요. 서로 달라 보여도 우리는 모두 하나라는 사랑스러운 메시지를 전합니다.",
  "readAloud": "아기의 손가락과 발가락을 직접 세어 주며 읽어 주세요 — 눈 맞춤과 스킨십으로 유대감이 쑥쑥 커져요!",
  "cover": {
   "emoji": "👶",
   "palette": [
    "#F9C8C8",
    "#FDEFC3"
   ]
  },
  "quality": 0.92,
  "source": "curated"
 },
 {
  "id": "en-where-is-the-green-sheep-2f51",
  "lang": "en",
  "title": "Where Is the Green Sheep?",
  "author": "Mem Fox & Judy Horacek",
  "publisher": "",
  "isbn": "9780152049072",
  "ages": [
   "0-2",
   "3-4"
  ],
  "level": "보드북",
  "themes": [
   "동물",
   "숫자/글자",
   "잠자리"
  ],
  "mood": [
   "웃긴",
   "잔잔한"
  ],
  "blurb": "파란 양, 빨간 양… 그런데 초록 양은 어디 있을까요? 반복되는 리듬 속에서 아이가 자연스럽게 색깔과 반대 개념을 익히고, 마지막 장에서 달콤한 잠든 초록 양을 발견하는 기쁨을 누릴 수 있어요.",
  "readAloud": "\"초록 양은 어디 있지?\" 하고 아이와 함께 페이지마다 큰 소리로 외쳐 보세요!",
  "cover": {
   "emoji": "🐑",
   "palette": [
    "#6DBF67",
    "#F9E04B"
   ]
  },
  "quality": 0.92,
  "source": "curated"
 },
 {
  "id": "en-possum-magic-dcf0",
  "lang": "en",
  "title": "Possum Magic",
  "author": "Mem Fox & Julie Vivas",
  "publisher": "",
  "isbn": "9780152632250",
  "ages": [
   "3-4",
   "5-6"
  ],
  "level": "그림책",
  "themes": [
   "동물",
   "환상",
   "음식",
   "모험"
  ],
  "mood": [
   "따뜻한",
   "모험"
  ],
  "blurb": "할머니 주머니쥐 헤나가 마법으로 손녀 헤나를 투명하게 만들어 버렸다가, 오스트레일리아 각지의 전통 음식을 먹으며 마법을 되돌리는 따뜻한 모험 이야기예요.",
  "readAloud": "오스트레일리아 음식 이름이 나올 때마다 \"이건 어떤 맛일까?\" 하고 아이와 함께 상상해 보세요!",
  "cover": {
   "emoji": "🐾",
   "palette": [
    "#c8e6a0",
    "#f4a460"
   ]
  },
  "quality": 0.92,
  "source": "curated"
 }
];
