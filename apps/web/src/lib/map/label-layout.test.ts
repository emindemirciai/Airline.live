import { describe, expect, it } from 'vitest'
import {
  CircleObstacles,
  LABEL_GAP,
  LABEL_ICON_RADIUS,
  layoutLabels,
  leaderEnd,
  type LabelBox,
  type PlacedLabel,
} from './label-layout'

const VIEW = { width: 800, height: 600 }
const NEAR = LABEL_ICON_RADIUS + LABEL_GAP

function box(id: string, anchorX: number, anchorY: number, overrides: Partial<LabelBox> = {}) {
  return { id, anchorX, anchorY, width: 80, height: 34, priority: 0, ...overrides }
}

const overlaps = (a: PlacedLabel, b: PlacedLabel, sizes: Map<string, LabelBox>) => {
  const sa = sizes.get(a.id)
  const sb = sizes.get(b.id)
  if (!sa || !sb) throw new Error('unknown label')
  return (
    a.x < b.x + sb.width && a.x + sa.width > b.x && a.y < b.y + sb.height && a.y + sa.height > b.y
  )
}

const coversIcon = (label: PlacedLabel, size: LabelBox, x: number, y: number) => {
  const dx = Math.max(label.x - x, 0, x - (label.x + size.width))
  const dy = Math.max(label.y - y, 0, y - (label.y + size.height))
  return dx * dx + dy * dy < LABEL_ICON_RADIUS * LABEL_ICON_RADIUS
}

/** Tekrarlanabilir sözde rastgele sayılar (LCG). */
function seeded(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0
    return state / 2 ** 32
  }
}

function randomBoxes(count: number, seed: number): LabelBox[] {
  const random = seeded(seed)
  return Array.from({ length: count }, (_, i) =>
    box(`ac${i}`, random() * 1440, random() * 900, {
      width: 60 + Math.floor(random() * 70),
      height: random() < 0.5 ? 18 : 34,
      priority: i === 0 ? 2 : random() < 0.2 ? 1 : 0,
    }),
  )
}

describe('layoutLabels — konumlar', () => {
  it('tek etiketi simgenin sağ üstüne, çizgisiz koyar', () => {
    expect(layoutLabels([box('a', 400, 300)], VIEW)).toEqual([
      { id: 'a', x: 400 + NEAR, y: 300 - 34 - 1, leader: false },
    ])
  })

  it('sağ kenardaki uçağın etiketini sola, üst kenardakini alta alır', () => {
    expect(layoutLabels([box('a', 780, 300)], VIEW)).toEqual([
      { id: 'a', x: 780 - NEAR - 80, y: 265, leader: false },
    ])
    expect(layoutLabels([box('a', 400, 10)], VIEW)).toEqual([
      { id: 'a', x: 400 + NEAR, y: 11, leader: false },
    ])
  })

  it('aynı noktadaki uçaklar sırayla dört yakın konumu, sonra çizgili konumları alır', () => {
    const boxes = ['a', 'b', 'c', 'd', 'e'].map((id) => box(id, 400, 300))
    const placed = layoutLabels(boxes, VIEW)
    expect(placed.slice(0, 4)).toEqual([
      { id: 'a', x: 418, y: 265, leader: false },
      { id: 'b', x: 418, y: 301, leader: false },
      { id: 'c', x: 302, y: 265, leader: false },
      { id: 'd', x: 302, y: 301, leader: false },
    ])
    expect(placed[4]).toMatchObject({ id: 'e', leader: true })
  })

  it('başka bir uçağın simgesini örtmez; etiketsiz uçaklar da engeldir', () => {
    const blocked = layoutLabels([box('a', 400, 300), box('b', 440, 285)], VIEW)
    expect(blocked.find((l) => l.id === 'a')).toMatchObject({
      x: 400 + NEAR,
      y: 301,
      leader: false,
    })
    const withObstacle = layoutLabels([box('a', 400, 300)], VIEW, {
      obstacles: [{ x: 440, y: 285 }],
    })
    expect(withObstacle).toEqual([{ id: 'a', x: 400 + NEAR, y: 301, leader: false }])
  })

  it('simge yarıçapı ve boşluk seçeneklerini kullanır', () => {
    expect(layoutLabels([box('a', 400, 300)], VIEW, { iconRadius: 20, gap: 10 })).toEqual([
      { id: 'a', x: 430, y: 265, leader: false },
    ])
  })
})

describe('layoutLabels — ayrılmış alanlar', () => {
  it('ayrılmış dikdörtgeni (birincil istasyonun kodu) örtmez; seçili etiket yer yoksa örtebilir', () => {
    const chip = { x: 400 + NEAR - 4, y: 300 - 30, width: 40, height: 16 }
    const [label] = layoutLabels([box('a', 400, 300)], VIEW, { reserved: [chip] })
    expect(label).toBeDefined()
    const placed = label as PlacedLabel
    const covers =
      placed.x < chip.x + chip.width &&
      placed.x + 80 > chip.x &&
      placed.y < chip.y + chip.height &&
      placed.y + 34 > chip.y
    expect(covers).toBe(false)
    // Ayrılmış alan yokken etiket aynı yere (sağ üst) gelirdi.
    expect(layoutLabels([box('a', 400, 300)], VIEW)[0]).toMatchObject({
      x: 400 + NEAR,
      y: 300 - 35,
    })
  })
})

describe('layoutLabels — haritanın üstündeki paneller (D-085)', () => {
  // 768 px'teki gibi: liste sağ üstte, alt kenarı ortalanan seçili uçağın 30 px üstünde.
  const list = { x: 404, y: 12, width: 352, height: 258 }
  const selected = box('sel', 584, 300, { width: 126, height: 39, priority: 2 })
  const hits = (label: PlacedLabel, size: LabelBox, r: typeof list) =>
    label.x < r.x + r.width &&
    label.x + size.width > r.x &&
    label.y < r.y + r.height &&
    label.y + size.height > r.y

  it('seçili etiket listeye değen sağ üst yerine listenin dışındaki ilk konuma (sağ alt) geçer', () => {
    // Panel yokken sağ üstte, listenin altında kalırdı.
    const [plain] = layoutLabels([selected], VIEW, { mustPlace: 'sel' })
    expect(plain).toMatchObject({ x: 584 + NEAR, y: 300 - 39 - 1, leader: false })
    expect(hits(plain as PlacedLabel, selected, list)).toBe(true)

    const [moved] = layoutLabels([selected], VIEW, { mustPlace: 'sel', panels: [list] })
    expect(moved).toEqual({ id: 'sel', x: 584 + NEAR, y: 301, leader: false })
    expect(hits(moved as PlacedLabel, selected, list)).toBe(false)
  })

  it('panel yalnızca seçili etiketi etkiler; diğer etiketler panelin altında kalabilir', () => {
    const other = box('other', 584, 300, { width: 126, height: 39 })
    expect(layoutLabels([other], VIEW, { panels: [list] })).toEqual([
      { id: 'other', x: 584 + NEAR, y: 260, leader: false },
    ])
  })

  it('her yer doluysa seçili etiket paneli örtmeyen yakın konuma, o da yoksa ilk yakın konuma', () => {
    const obstacles = []
    for (let x = 0; x <= VIEW.width; x += 10) {
      for (let y = 0; y <= VIEW.height; y += 10) obstacles.push({ x, y })
    }
    const [label] = layoutLabels([selected], VIEW, {
      obstacles,
      mustPlace: 'sel',
      panels: [list],
    })
    expect(label).toEqual({ id: 'sel', x: 584 + NEAR, y: 301, leader: false })
    // Bütün yakın konumları örten panel: ilk yakın konum (sağ üst).
    const everywhere = { x: 0, y: 0, width: VIEW.width, height: VIEW.height }
    expect(
      layoutLabels([selected], VIEW, { obstacles, mustPlace: 'sel', panels: [everywhere] }),
    ).toEqual([{ id: 'sel', x: 584 + NEAR, y: 260, leader: false }])
  })
})

describe('layoutLabels — öncelik', () => {
  it('çekişmeli yeri yüksek öncelikli alır; eşitlikte kimlik sırası belirler', () => {
    const placed = layoutLabels(
      [box('z', 400, 300), box('m', 400, 300, { priority: 1 }), box('a', 400, 300)],
      VIEW,
    )
    expect(placed.map((l) => l.id)).toEqual(['m', 'a', 'z'])
    expect(placed[0]).toMatchObject({ x: 418, y: 265 })
  })

  it('seçili etiket yer yoksa da ilk yakın konuma yerleşir; diğerleri çizilmez', () => {
    // Her 10 px'te bir simge: hiçbir konum boş değil.
    const obstacles = []
    for (let x = 0; x <= VIEW.width; x += 10) {
      for (let y = 0; y <= VIEW.height; y += 10) obstacles.push({ x, y })
    }
    const placed = layoutLabels(
      [box('selected', 400, 300, { priority: 2 }), box('other', 200, 200)],
      VIEW,
      { obstacles, mustPlace: 'selected' },
    )
    expect(placed).toEqual([{ id: 'selected', x: 418, y: 265, leader: false }])
  })

  it('seçim yokken en öncelikli etiket bile yer bulamazsa simgelerin üstüne çizilmez', () => {
    const obstacles = []
    for (let x = 0; x <= VIEW.width; x += 10) {
      for (let y = 0; y <= VIEW.height; y += 10) obstacles.push({ x, y })
    }
    const boxes = [box('thy', 400, 300, { priority: 2 }), box('other', 200, 200)]
    expect(layoutLabels(boxes, VIEW, { obstacles })).toEqual([])
    expect(layoutLabels(boxes, VIEW, { obstacles, mustPlace: null })).toEqual([])
    // Seçili uçağın etiketi "Gizle" ise (kutusu yok) başka bir etiket zorla yerleşmez.
    expect(layoutLabels(boxes, VIEW, { obstacles, mustPlace: 'hidden-selected' })).toEqual([])
  })

  it('kalabalık önlükte seçim yokken ortadaki öncelikli uçağın etiketi de simge örtmez', () => {
    // 15 × 15 uçak, 12 px arayla: ortadakinin hiçbir aday konumu boş değil.
    const boxes: LabelBox[] = []
    for (let row = -7; row <= 7; row++) {
      for (let col = -7; col <= 7; col++) {
        const centre = row === 0 && col === 0
        boxes.push(
          box(centre ? 'centre' : `ac${row}:${col}`, 400 + col * 12, 300 + row * 12, {
            priority: centre ? 2.9 : 1,
          }),
        )
      }
    }
    const placed = layoutLabels(boxes, VIEW, { iconRadius: LABEL_ICON_RADIUS })
    expect(placed.map((label) => label.id)).not.toContain('centre')
    const sizes = new Map(boxes.map((b) => [b.id, b]))
    for (const label of placed) {
      const size = sizes.get(label.id) as LabelBox
      for (const other of boxes) {
        expect(
          coversIcon(label, size, other.anchorX, other.anchorY),
          `${label.id}/${other.id}`,
        ).toBe(false)
      }
    }
  })

  it('seçili etiket görünümden taşacaksa içeri kaydırılır', () => {
    const obstacles = []
    for (let x = 0; x <= 200; x += 10) {
      for (let y = 0; y <= 100; y += 10) obstacles.push({ x, y })
    }
    const placed = layoutLabels(
      [box('s', 5, 5, { width: 190, height: 95, priority: 2 })],
      {
        width: 200,
        height: 100,
      },
      { obstacles, mustPlace: 's' },
    )
    expect(placed).toEqual([{ id: 's', x: 10, y: 0, leader: false }])
  })

  it('simgesi görünüm dışındaki uçağın etiketi yoktur; kısmen görünenin vardır', () => {
    expect(layoutLabels([box('s', -50, 300, { priority: 2 })], VIEW)).toEqual([])
    expect(layoutLabels([box('a', -5, 300)], VIEW)).toEqual([
      { id: 'a', x: -5 + NEAR, y: 265, leader: false },
    ])
  })

  it('boş görünümde ya da boyutsuz etikette sonuç boştur', () => {
    expect(layoutLabels([box('a', 0, 0)], { width: 0, height: 600 })).toEqual([])
    expect(layoutLabels([box('a', 400, 300, { width: 0 })], VIEW)).toEqual([])
    expect(layoutLabels([], VIEW)).toEqual([])
  })
})

describe('layoutLabels — değişmezler ve hız', () => {
  it('rastgele yoğun trafikte etiketler çakışmaz, görünümde kalır, simge örtmez', () => {
    const boxes = randomBoxes(500, 42)
    const view = { width: 1440, height: 900 }
    const placed = layoutLabels(boxes, view)
    const sizes = new Map(boxes.map((b) => [b.id, b]))
    expect(placed[0]?.id).toBe('ac0')
    expect(placed.length).toBeGreaterThan(50)
    expect(new Set(placed.map((l) => l.id)).size).toBe(placed.length)
    // Yüz binlerce çift denetlenir; her biri için ayrı expect CI'da saniyeler sürer. İhlaller
    // toplanır ve tek seferde doğrulanır (boş liste beklenir).
    const violations: string[] = []
    for (const [i, label] of placed.entries()) {
      const size = sizes.get(label.id)
      if (!size) throw new Error('unknown label')
      if (label.x < 0 || label.y < 0) violations.push(`${label.id}: outside top/left`)
      if (label.x + size.width > view.width || label.y + size.height > view.height) {
        violations.push(`${label.id}: outside bottom/right`)
      }
      for (const other of placed.slice(i + 1)) {
        if (overlaps(label, other, sizes)) violations.push(`${label.id}: overlaps ${other.id}`)
      }
      for (const b of boxes) {
        if (coversIcon(label, size, b.anchorX, b.anchorY)) {
          violations.push(`${label.id}: covers icon ${b.id}`)
        }
      }
    }
    expect(violations).toEqual([])
  })

  it('aynı girdiye aynı sonucu verir (girdi sırasından bağımsız)', () => {
    const boxes = randomBoxes(200, 7)
    const view = { width: 1440, height: 900 }
    expect(layoutLabels([...boxes].reverse(), view)).toEqual(layoutLabels(boxes, view))
  })

  it('500 etiketi hızlı yerleştirir', () => {
    const boxes = randomBoxes(500, 1)
    const view = { width: 1440, height: 900 }
    for (let i = 0; i < 5; i++) layoutLabels(boxes, view)
    const times: number[] = []
    for (let i = 0; i < 9; i++) {
      const start = performance.now()
      layoutLabels(boxes, view)
      times.push(performance.now() - start)
    }
    times.sort((a, b) => a - b)
    // Hedef dizüstünde < 8 ms; CI makineleri için geniş pay.
    expect(times[4]).toBeLessThan(50)
  })
})

describe('CircleObstacles', () => {
  it('dikdörtgenin daireye değip değmediğini söyler (köşe yakınlığı dahil)', () => {
    const obstacles = new CircleObstacles(VIEW)
    obstacles.add(100, 100, 10)
    expect(obstacles.hits(105, 95, 20, 20)).toBe(true)
    expect(obstacles.hits(111, 100, 20, 20)).toBe(false)
    // Köşeye uzaklık √(8² + 8²) ≈ 11,3 > 10.
    expect(obstacles.hits(108, 108, 20, 20)).toBe(false)
    expect(obstacles.hits(106, 106, 20, 20)).toBe(true)
    expect(obstacles.hits(300, 300, 20, 20)).toBe(false)
  })
})

describe('leaderEnd', () => {
  it('etiket dikdörtgeninin simgeye en yakın noktasını verir', () => {
    const rect = { x: 100, y: 50, width: 80, height: 30 }
    expect(leaderEnd(60, 20, rect)).toEqual({ x: 100, y: 50 })
    expect(leaderEnd(140, 120, rect)).toEqual({ x: 140, y: 80 })
    expect(leaderEnd(220, 60, rect)).toEqual({ x: 180, y: 60 })
  })
})
