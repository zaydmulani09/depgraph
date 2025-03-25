import type cytoscape from 'cytoscape'

export function buildCytoscapeStylesheet(): cytoscape.Stylesheet[] {
  return [
    {
      selector: 'node',
      style: {
        shape: 'roundrectangle',
        'background-color': 'data(riskColor)' as unknown as string,
        'background-opacity': 0.15,
        'border-width': 1,
        'border-color': 'data(riskColor)' as unknown as string,
        'border-opacity': 1,
        label: 'data(label)',
        'font-size': 11,
        color: '#e8e8f0',
        'text-wrap': 'wrap',
        'text-max-width': '120px',
        'text-valign': 'center',
        'text-halign': 'center',
        width: 'label',
        height: 'label',
        'padding-top': '8px',
        'padding-bottom': '8px',
        'padding-left': '12px',
        'padding-right': '12px',
      } as unknown as cytoscape.Css.Node,
    },
    {
      selector: 'node:selected',
      style: {
        'border-width': 2,
        'border-color': '#6655ff',
        'background-opacity': 0.3,
      } as unknown as cytoscape.Css.Node,
    },
    {
      selector: 'node.selected',
      style: {
        'border-width': 2,
        'border-color': '#6655ff',
        'background-opacity': 0.3,
      } as unknown as cytoscape.Css.Node,
    },
    {
      selector: 'node:active',
      style: {
        opacity: 0.8,
      } as unknown as cytoscape.Css.Node,
    },
    {
      selector: 'edge',
      style: {
        width: 1,
        'line-color': '#2a2a3a',
        'target-arrow-color': '#2a2a3a',
        'target-arrow-shape': 'triangle',
        'arrow-scale': 0.7,
        'curve-style': 'bezier',
        opacity: 0.6,
      } as unknown as cytoscape.Css.Edge,
    },
    {
      selector: 'edge[depth = 1]',
      style: {
        'line-color': '#3a3a4e',
        'target-arrow-color': '#3a3a4e',
        opacity: 0.8,
      } as unknown as cytoscape.Css.Edge,
    },
  ]
}
