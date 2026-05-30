# korean-mbti — portrait style bible (감성 grain card)

**Date:** 2026-05-30
**Audience:** Korean women, ~20–40. Art must read as native Korean 2025–26, not
generic/Western/AI.
**Scope:** 32 portraits = 16 MBTI types × {women, men}. Women set is primary
(demo default); men set mirrors it with a male subject, same style/scene.

## Direction (locked)

**감성 grain card.** A single cute, soft 몽글몽글-rounded figure per type,
minimal/no hard outline, defined by gentle color blocks + soft shading, set on a
soft grainy gradient cream ground with fine film-grain / risograph texture. Calm,
warm, tasteful "MZ adult" — not loud, not childish, not masculine.

This is a **style-consistency** problem, not character-identity consistency: the
16 subjects are *different people*; what must stay constant across all 32 is the
treatment (palette discipline, grain, roundness, framing, negative space).

## Canonical style string (use verbatim in every prompt)

> cute soft Korean lifestyle illustration, one {woman|man} in their late 20s,
> 몽글몽글 rounded gentle forms, minimal delicate linework almost no outline,
> soft shading with color blocks, muted dusty pastel palette, soft grainy
> gradient background, fine film grain and subtle risograph texture, warm cream
> off-white ground, low contrast, calm 감성 mood, gentle soft lighting,
> flat-but-textured, small full figure with generous negative space, tasteful
> modern, single figure

## Canonical negative prompt (verbatim)

> harsh thick black outlines, saturated primary colors, neon, pure white
> background, high contrast, 3d render, clay render, photorealistic, corporate
> memphis, gangly long limbs, mismatched skin tones, deformed hands, extra
> fingers, malformed face, text, letters, watermark, logo, signature, gritty,
> dark, edgy, masculine angular geometry, low quality, low resolution

(Note: figures are kept small and simple so hands/anatomy stay minimal — the
biggest AI failure mode for this style.)

## Temperament-group palettes (color-code the 4 groups)

Pass these to `generate_image_with_colors` as the `colors` array (plus cream).

| Group | Types | Palette family | Hex anchors |
|---|---|---|---|
| **NT** Analysts | INTJ INTP ENTJ ENTP | Digital lavender / dusty violet | `#ADA7FF` `#8E86C9` `#C9C2E8` `#EFEAE0` (cream) |
| **NF** Diplomats | INFJ INFP ENFJ ENFP | Warm coral / soft rust | `#D96E54` `#E8997F` `#F0C9B0` `#EFEAE0` |
| **SJ** Sentinels | ISTJ ISFJ ESTJ ESFJ | Muted sage / quietude | `#9CAA8E` `#7E906F` `#C6CDB4` `#EFEAE0` |
| **SP** Explorers | ISTP ISFP ESTP ESFP | Warm honey / soft amber | `#E3B25A` `#D89A3E` `#F0D9A8` `#EFEAE0` |

Always include the cream `#EFEAE0` so backgrounds stay warm off-white, never pure white.

## Per-type subject + scene (one cute micro-scene that encodes the type)

Each = `{group palette}` + style string + this subject line. Women set: woman.
Men set: identical scene with a man.

| Type | Nickname | Scene / props |
|---|---|---|
| INTJ | 전략가 | seated at a desk before a large strategy chart, one chess piece, calm focused |
| INTP | 논리술사 | surrounded by floating question marks, open books and small gears, curious |
| ENTJ | 통솔자 | striding forward confidently, pointing ahead, a rising arrow motif |
| ENTP | 변론가 | mid-gesture talking with bright idea bubbles and a lightbulb floating |
| INFJ | 조용한 통찰가 | quietly reading by soft candlelight under a gentle moon, contemplative |
| INFP | 잔망 루피 | daydreaming among soft clouds and small flowers, cozy and dreamy |
| ENFJ | 따뜻한 리더 | warmly gathering little friends together, a soft heart motif |
| ENFP | 스파크 | leaping joyfully amid sparkles and confetti, bright and free |
| ISTJ | 신뢰의 아이콘 | at a tidy desk with a checklist and a stamp, neat and steady |
| ISFJ | 곰돌이 푸 | offering a warm cup of tea and a blanket, a tiny bear plush nearby, caring |
| ESTJ | 엄격한 관리자 | organizing with a clipboard, neat stacked boxes, structured and sure |
| ESFJ | 친목왕 | hosting warmly, setting a small table of food for friends |
| ISTP | 맥가이버 | calmly fixing a small gadget with simple tools, cool and capable |
| ISFP | 잔잔한 감성러 | painting at a little easel with soft art supplies, gentle and aesthetic |
| ESTP | 현장형 행동파 | on the move on a skateboard, dynamic but cute, motion lines |
| ESFP | 분위기 메이커 | dancing happily with floating music notes, joyful and warm |

## Output spec

- **1024×1024** (square; matches existing assets and both crops — the result
  hero crops to 16:10 top-third via `object-position: center 32%`, the share
  card crops to 3:4). Keep the figure centered-upper so both crops frame it.
- Saved as JPG to `korean-mbti/portraits/{women,men}/{type}.jpg` (lowercase).
- `generate_image_with_colors`, `quality: "premium"`, cfg ~6.5.

## QA gate (per image, before approval)

- Style: soft grain texture present; muted palette (no neon/primary); cream (not
  white) ground; rounded 몽글몽글 forms; delicate/no hard outline.
- Subject: correct gender for the set; one figure; reads as Korean adult 20–40;
  scene legibly evokes the type.
- Quality: no deformed hands/face, no text/watermark, no extra limbs.
- Group palette correct (NT lavender / NF coral / SJ sage / SP honey).
- Cross-set: women & men of the same type share scene + palette + treatment.
- Verdict: APPROVE or REGENERATE (note issue).

## Calibration

Generate 1–2 first (flagship INFP-women + one other group), eyeball against this
bible + get user sign-off, THEN batch the remaining. Lock the working prompt
recipe before scaling to 32.
