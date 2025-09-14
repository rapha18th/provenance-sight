import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { NetworkNode, NetworkEdge } from '@/lib/store';

interface NetworkGraphProps {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  width?: number;
  height?: number;
  onNodeClick?: (node: NetworkNode) => void;
}

export function NetworkGraph({ 
  nodes, 
  edges, 
  width = 800, 
  height = 600, 
  onNodeClick 
}: NetworkGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !nodes.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // Clear previous render

    // Create a copy of the data to avoid mutation
    const nodesCopy = nodes.map(d => ({ ...d }));
    const edgesCopy = edges.map(d => ({ ...d }));

    // Set up the simulation
    const simulation = d3.forceSimulation(nodesCopy as any)
      .force("link", d3.forceLink(edgesCopy as any).id((d: any) => d.id).distance(100))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(30));

    // Create the container group
    const container = svg.append("g");

    // Add zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.5, 3])
      .on("zoom", (event) => {
        container.attr("transform", event.transform);
      });

    svg.call(zoom as any);

    // Create edges
    const link = container.append("g")
      .selectAll("line")
      .data(edgesCopy)
      .join("line")
        .attr("stroke", (d) => {
          // Use policy array to determine edge color
          if (d.policy && d.policy.includes('NAZI_ERA')) return 'hsl(var(--edge-nazi))';
          if (d.policy && d.policy.includes('UNESCO_1970')) return 'hsl(var(--edge-unesco))';
          return 'hsl(var(--edge-normal))';
        })
      .attr("stroke-width", 2)
      .attr("stroke-opacity", 0.8);

    // Create nodes
    const node = container.append("g")
      .selectAll("g")
      .data(nodesCopy)
      .join("g")
      .attr("cursor", "pointer")
      .call(d3.drag<any, any>()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended));

    // Add circles to nodes
    node.append("circle")
      .attr("r", (d) => d.type === 'object' ? 20 : 15)
      .attr("fill", (d) => {
        switch (d.type) {
          case 'object': return 'hsl(var(--node-object))';
          case 'actor': return 'hsl(var(--node-person))';
          case 'place': return 'hsl(var(--node-place))';
          default: return 'hsl(var(--slate-500))';
        }
      })
      .attr("stroke", "hsl(var(--slate-600))")
      .attr("stroke-width", 1);

    // Add labels to nodes
    node.append("text")
      .text((d) => d.label)
      .attr("font-size", "12px")
      .attr("font-family", "system-ui, sans-serif")
      .attr("fill", "hsl(var(--slate-100))")
      .attr("text-anchor", "middle")
      .attr("dy", (d) => d.type === 'object' ? 35 : 30);

    // Add hover effects
    node
      .on("mouseover", function(event, d: NetworkNode) {
        d3.select(this).select("circle")
          .transition()
          .duration(200)
          .attr("r", d.type === 'object' ? 25 : 20);
      })
      .on("mouseout", function(event, d: NetworkNode) {
        d3.select(this).select("circle")
          .transition()
          .duration(200)
          .attr("r", d.type === 'object' ? 20 : 15);
      })
      .on("click", function(event, d: NetworkNode) {
        if (onNodeClick) onNodeClick(d);
      });

    // Update positions on tick
    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      node
        .attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

    // Drag functions
    function dragstarted(event: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event: any) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event: any) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }

    return () => {
      simulation.stop();
    };
  }, [nodes, edges, width, height, onNodeClick]);

  return (
    <div className="w-full h-full bg-slate-900 rounded-lg overflow-hidden">
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="w-full h-full"
        style={{ background: 'hsl(var(--slate-900))' }}
      />
    </div>
  );
}