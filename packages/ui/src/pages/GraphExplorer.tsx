import React, { useRef, useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import CytoscapeComponent from 'react-cytoscapejs'
import type cytoscape from 'cytoscape'
import { fetchPackageDetail, GraphNode, GraphEdge } from '../lib/api'
import { usePackageSubgraph, useBlastRadius, useChokepoints } from '../hooks/useGraph'
import { riskColor } from '../lib/risk-colors'
import { buildCytoscapeStylesheet } from '../lib/cytoscape-styles'
import { NodeDetailPanel } from '../components/graph/NodeDetailPanel'
import { GraphControls } from '../components/graph/GraphControls'
import { LoadingSpinner } from '../components/LoadingSpinner'

const LAYOUT_OPTIONS = {
  name: 'cose',
  animate: false,
  randomize: false,
  nodeRepulsion: 8000,
  idealEdgeLength: 80,
}

export function GraphExplorer() {
  const navigate = useNavigate()
  const cyRef = useRef<cytoscape.Core | null>(null)

  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null)
  const [searchInput, setSearchInput] = useState('')
  const [searchedPackageId, setSearchedPackageId] = useState<string | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)
  const [depth, setDepth] = useState(2)
  const [ecosystem, setEcosystem] = useState<string | null>(null)

  const isSubgraphMode = searchedPackageId !== null

  const chokepointsQuery = useChokepoints({
    ecosystem: ecosystem ?? undefined,
    limit: 50,
  })

  const subgraphQuery = usePackageSubgraph(searchedPackageId, depth)

  const blastRadiusQuery = useBlastRadius(selectedPackageId)

  const nodes: GraphNode[] = isSubgraphMode
    ? (subgraphQuery.data?.nodes ?? [])
    : (chokepointsQuery.data?.map((cp) => ({
        id: cp.packageId,
        name: cp.packageName,
        ecosystem: cp.ecosystem,
        compositeScore: cp.compositeScore,
      })) ?? [])

  const edges: GraphEdge[] = isSubgraphMode ? (subgraphQuery.data?.edges ?? []) : []

  const elements: cytoscape.ElementDefinition[] = [
    ...nodes.map((n) => ({
      data: {
        id: n.id,
        label: n.name,
        riskColor: riskColor(n.compositeScore),
        ecosystem: n.ecosystem,
        compositeScore: n.compositeScore,
      },
    })),
    ...edges.map((e) => ({
      data: {
        id: `${e.fromId}-${e.toId}`,
        source: e.fromId,
        target: e.toId,
        depth: e.depth,
      },
    })),
  ]

  const isLoading = isSubgraphMode ? subgraphQuery.isLoading : chokepointsQuery.isLoading
  const isEmpty = !isLoading && nodes.length === 0

  const selectedNode = nodes.find((n) => n.id === selectedPackageId) ?? null

  // Sync selected class with cytoscape
  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return
    cy.$('.selected').removeClass('selected')
    if (selectedPackageId) {
      cy.$(`#${CSS.escape(selectedPackageId)}`).addClass('selected')
    }
  }, [selectedPackageId])

  const cyCallback = useCallback((cy: cytoscape.Core) => {
    cyRef.current = cy
    cy.off('tap', 'node')
    cy.off('tap')
    cy.on('tap', 'node', (e: cytoscape.EventObject) => {
      setSelectedPackageId((e.target as cytoscape.NodeSingular).id())
    })
    cy.on('tap', (e: cytoscape.EventObject) => {
      if (e.target === cy) setSelectedPackageId(null)
    })
  }, [])

  const handleFitView = useCallback(() => {
    cyRef.current?.fit(undefined, 40)
  }, [])

  const handleResetLayout = useCallback(() => {
    cyRef.current?.layout(LAYOUT_OPTIONS as cytoscape.LayoutOptions).run()
  }, [])

  const handleSearch = async () => {
    const term = searchInput.trim()
    if (!term) return
    setSearchError(null)
    setSearching(true)
    try {
      const pkg = await fetchPackageDetail(ecosystem ?? 'npm', term)
      setSearchedPackageId(pkg.id)
      setSelectedPackageId(null)
    } catch {
      setSearchError('Package not found')
      setSearchedPackageId(null)
    } finally {
      setSearching(false)
    }
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSearch()
  }

  const handleNavigate = (eco: string, name: string) => {
    navigate(`/packages/${eco}/${name}`)
  }

  const handleClearSearch = () => {
    setSearchedPackageId(null)
    setSearchInput('')
    setSearchError(null)
    setSelectedPackageId(null)
  }

  const graphKey = isSubgraphMode
    ? `subgraph-${searchedPackageId}-${depth}`
    : `chokepoints-${ecosystem ?? 'all'}`

  return (
    <div
      style={{
        margin: '-28px',
        height: 'calc(100% + 56px)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Search bar */}
      <div
        style={{
          padding: '10px 16px',
          background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--bg-border)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexShrink: 0,
        }}
      >
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          placeholder="Search package name..."
          style={{
            flex: 1,
            maxWidth: 360,
            padding: '6px 10px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--bg-border)',
            borderRadius: 'var(--radius)',
            color: 'var(--text-primary)',
            fontSize: 13,
            outline: 'none',
            fontFamily: 'var(--font-mono)',
          }}
        />
        <button
          onClick={handleSearch}
          disabled={searching}
          style={{
            padding: '6px 14px',
            background: 'var(--accent-dim)',
            border: '1px solid var(--accent)',
            borderRadius: 'var(--radius)',
            color: 'var(--accent)',
            fontSize: 13,
            fontWeight: 500,
            cursor: searching ? 'not-allowed' : 'pointer',
            opacity: searching ? 0.6 : 1,
          }}
        >
          {searching ? 'Searching…' : 'Search'}
        </button>
        {isSubgraphMode && (
          <button
            onClick={handleClearSearch}
            style={{
              padding: '6px 10px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--bg-border)',
              borderRadius: 'var(--radius)',
              color: 'var(--text-muted)',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            ← Chokepoints
          </button>
        )}
        {searchError && (
          <span style={{ fontSize: 12, color: 'var(--risk-critical)' }}>{searchError}</span>
        )}
        {!isSubgraphMode && (
          <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 4 }}>
            Showing top chokepoints
          </span>
        )}
      </div>

      {/* Graph controls */}
      <GraphControls
        ecosystem={ecosystem}
        onEcosystemChange={setEcosystem}
        depth={depth}
        onDepthChange={setDepth}
        onFitView={handleFitView}
        onResetLayout={handleResetLayout}
        nodeCount={nodes.length}
        edgeCount={edges.length}
      />

      {/* Graph area */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {isLoading && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 5,
              background: 'var(--bg-base)',
            }}
          >
            <LoadingSpinner label="Loading graph..." />
          </div>
        )}

        {!isLoading && isEmpty && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <span style={{ fontSize: 15, color: 'var(--text-secondary)' }}>
              No graph data available.
            </span>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Run the crawler to index packages.
            </span>
          </div>
        )}

        {!isEmpty && (
          <CytoscapeComponent
            key={graphKey}
            elements={elements}
            stylesheet={buildCytoscapeStylesheet()}
            layout={LAYOUT_OPTIONS as cytoscape.LayoutOptions}
            cy={cyCallback}
            style={{ width: '100%', height: '100%' }}
          />
        )}

        <NodeDetailPanel
          node={selectedNode}
          blastRadius={blastRadiusQuery.data ?? null}
          isLoading={blastRadiusQuery.isLoading}
          onClose={() => setSelectedPackageId(null)}
          onNavigate={handleNavigate}
        />
      </div>
    </div>
  )
}
