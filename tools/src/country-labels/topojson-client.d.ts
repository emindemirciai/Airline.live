/**
 * topojson-client 3.1.0'ın kullanılan tek işlevinin tipi (`@types` paketi eklenmez, D-096).
 * `merge`, topolojideki çokgenleri ortak yaylarından birleştirir ve GeoJSON MultiPolygon döndürür.
 */
declare module 'topojson-client' {
  export interface TopologyGeometry {
    type: string
    id?: string
    arcs?: unknown
    properties?: Record<string, unknown>
  }

  export interface Topology {
    type: 'Topology'
    arcs: (readonly (readonly [number, number])[])[]
    objects: Record<string, unknown>
    transform?: { scale: [number, number]; translate: [number, number] }
  }

  export function merge(
    topology: Topology,
    objects: readonly TopologyGeometry[],
  ): { type: 'MultiPolygon'; coordinates: [number, number][][][] }
}
