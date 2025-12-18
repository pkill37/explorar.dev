'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { getUserFollowing, getUserFollowers, FollowingUser, FollowerUser } from '@/lib/worker-api';

type NodeType = 'user' | 'following' | 'follower';

type GraphNode = {
  id: string;
  name: string;
  avatar?: string;
  type: NodeType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  isPinned?: boolean;
};

type GraphLink = {
  source: string;
  target: string;
  type: 'following' | 'follower';
};

type ViewTransform = { k: number; x: number; y: number };

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function nodeRadius(type: NodeType) {
  return type === 'user' ? 15 : 8;
}

function colors(type: NodeType) {
  if (type === 'user') return { fill: '#3b82f6', text: '#3b82f6' };
  if (type === 'following') return { fill: '#10b981', text: '#9ca3af' };
  return { fill: '#f59e0b', text: '#9ca3af' };
}

function svgPointToGraphPoint(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
  t: ViewTransform
) {
  const rect = svg.getBoundingClientRect();
  const sx = clientX - rect.left;
  const sy = clientY - rect.top;
  return { x: (sx - t.x) / t.k, y: (sy - t.y) / t.k };
}

export default function NetworkPage() {
  const [following, setFollowing] = useState<FollowingUser[]>([]);
  const [followers, setFollowers] = useState<FollowerUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const svgRef = useRef<SVGSVGElement>(null);

  const [transform, setTransform] = useState<ViewTransform>({ k: 1, x: 0, y: 0 });
  const [graphNodes, setGraphNodes] = useState<GraphNode[]>([]);
  const [graphLinks, setGraphLinks] = useState<GraphLink[]>([]);
  const nodeMapRef = useRef<Map<string, GraphNode>>(new Map());
  const rafRef = useRef<number | null>(null);

  const interactionRef = useRef<
    | { kind: 'none' }
    | { kind: 'pan'; pointerId: number; startX: number; startY: number; startT: ViewTransform }
    | { kind: 'drag-node'; pointerId: number; nodeId: string }
  >({ kind: 'none' });

  useEffect(() => {
    const loadNetwork = async () => {
      try {
        setLoading(true);
        const [followingData, followersData] = await Promise.all([
          getUserFollowing().catch(() => []),
          getUserFollowers().catch(() => []),
        ]);
        setFollowing(followingData);
        setFollowers(followersData);
        setError(null);
      } catch (err) {
        console.error('Failed to load network:', err);
        setError(err instanceof Error ? err.message : 'Failed to load network data');
      } finally {
        setLoading(false);
      }
    };

    loadNetwork();
  }, []);

  // Build graph data
  const buildGraphData = useCallback(() => {
    const nodes: Omit<GraphNode, 'x' | 'y' | 'vx' | 'vy' | 'r'>[] = [];
    const links: GraphLink[] = [];

    // Add current user (center node)
    nodes.push({
      id: 'current-user',
      name: 'You',
      type: 'user',
    });

    // Add following nodes
    following.forEach((user) => {
      nodes.push({
        id: `following-${user.following_user_id}`,
        name: user.following_login,
        avatar: user.following_avatar_url,
        type: 'following',
      });
      links.push({
        source: 'current-user',
        target: `following-${user.following_user_id}`,
        type: 'following',
      });
    });

    // Add follower nodes
    followers.forEach((user) => {
      const existingNode = nodes.find((n) => n.id === `follower-${user.follower_user_id}`);
      if (!existingNode) {
        nodes.push({
          id: `follower-${user.follower_user_id}`,
          name: user.follower_login,
          avatar: user.follower_avatar_url,
          type: 'follower',
        });
      }
      links.push({
        source: `follower-${user.follower_user_id}`,
        target: 'current-user',
        type: 'follower',
      });
    });

    // Filter by search term
    if (searchTerm) {
      const filteredNodes = nodes.filter((node) =>
        node.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      const filteredNodeIds = new Set(filteredNodes.map((n) => n.id));
      const filteredLinks = links.filter((link) => {
        return filteredNodeIds.has(link.source) && filteredNodeIds.has(link.target);
      });

      // Always include current user
      if (!filteredNodeIds.has('current-user')) {
        filteredNodes.unshift(nodes.find((n) => n.id === 'current-user')!);
      }

      return { nodes: filteredNodes, links: filteredLinks };
    }

    return { nodes, links };
  }, [following, followers, searchTerm]);

  useEffect(() => {
    if (!svgRef.current || loading || error) return;

    const svg = svgRef.current;
    const width = svg.clientWidth || 800;
    const height = 600;

    const data = buildGraphData();
    if (data.nodes.length === 1) {
      setGraphNodes([]);
      setGraphLinks([]);
      nodeMapRef.current = new Map();
      return;
    }

    const existing = nodeMapRef.current;
    const nextMap = new Map<string, GraphNode>();

    const centerX = width / 2;
    const centerY = height / 2;
    const spread = Math.min(width, height) * 0.35;

    const nextNodes: GraphNode[] = data.nodes.map((n, idx) => {
      const prev = existing.get(n.id);
      const r = nodeRadius(n.type);
      const angle = (idx / Math.max(1, data.nodes.length)) * Math.PI * 2;

      const node: GraphNode = prev
        ? { ...prev, name: n.name, avatar: n.avatar, type: n.type, r }
        : {
            id: n.id,
            name: n.name,
            avatar: n.avatar,
            type: n.type,
            x: centerX + Math.cos(angle) * spread + (Math.random() - 0.5) * 30,
            y: centerY + Math.sin(angle) * spread + (Math.random() - 0.5) * 30,
            vx: 0,
            vy: 0,
            r,
          };

      nextMap.set(node.id, node);
      return node;
    });

    // Force current user toward center for stability
    const me = nextMap.get('current-user');
    if (me) {
      me.x = centerX;
      me.y = centerY;
      me.vx = 0;
      me.vy = 0;
      me.isPinned = true;
    }

    nodeMapRef.current = nextMap;
    setGraphNodes(nextNodes);
    setGraphLinks(data.links);

    // Start/restart simulation loop
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    let last = performance.now();
    const tick = (now: number) => {
      const dtMs = now - last;
      last = now;
      const dt = clamp(dtMs / 16.67, 0.5, 2); // normalize to ~60fps steps

      const nodes = Array.from(nodeMapRef.current.values());
      if (nodes.length === 0) return;

      const links = data.links;
      const nodeById = nodeMapRef.current;

      // Parameters tuned for "small social graphs"
      const linkDistance = 100;
      const springK = 0.02;
      const repulsionK = 1600;
      const collisionK = 0.5;
      const centerK = 0.002;
      const damping = 0.88;

      // Centering force
      for (const n of nodes) {
        if (n.isPinned) continue;
        n.vx += (centerX - n.x) * centerK * dt;
        n.vy += (centerY - n.y) * centerK * dt;
      }

      // Link (spring) forces
      for (const l of links) {
        const a = nodeById.get(l.source);
        const b = nodeById.get(l.target);
        if (!a || !b) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.0001;
        const diff = dist - linkDistance;
        const fx = (dx / dist) * diff * springK * dt;
        const fy = (dy / dist) * diff * springK * dt;
        if (!a.isPinned) {
          a.vx += fx;
          a.vy += fy;
        }
        if (!b.isPinned) {
          b.vx -= fx;
          b.vy -= fy;
        }
      }

      // Repulsion + collision
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist2 = dx * dx + dy * dy + 0.01;
          const dist = Math.sqrt(dist2);
          const ux = dx / dist;
          const uy = dy / dist;

          // repulsion
          const repel = (repulsionK / dist2) * dt;
          if (!a.isPinned) {
            a.vx -= ux * repel;
            a.vy -= uy * repel;
          }
          if (!b.isPinned) {
            b.vx += ux * repel;
            b.vy += uy * repel;
          }

          // collision (extra push when overlapping)
          const minDist = a.r + b.r + 14;
          if (dist < minDist) {
            const push = (minDist - dist) * collisionK * dt;
            if (!a.isPinned) {
              a.vx -= ux * push;
              a.vy -= uy * push;
            }
            if (!b.isPinned) {
              b.vx += ux * push;
              b.vy += uy * push;
            }
          }
        }
      }

      // Integrate
      for (const n of nodes) {
        if (n.isPinned) continue;
        n.vx *= damping;
        n.vy *= damping;
        n.x += n.vx * dt;
        n.y += n.vy * dt;
      }

      // Push latest positions to React state at animation rate
      setGraphNodes(nodes.map((n) => ({ ...n })));
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [buildGraphData, loading, error]);

  const resetView = () => {
    setTransform({ k: 1, x: 0, y: 0 });
  };

  const graphData = buildGraphData();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-400">Loading network data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-red-400">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-100 mb-2">Network Visualization</h1>
        <p className="text-gray-400">
          {following.length} following • {followers.length} followers
        </p>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <input
          type="text"
          placeholder="Search users..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 px-4 py-2 bg-gray-800/50 border border-gray-700/50 rounded-lg text-gray-200 placeholder:text-gray-500 focus:outline-none focus:border-gray-600"
        />
        <button
          onClick={resetView}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg transition-colors"
        >
          Reset View
        </button>
      </div>

      {/* Graph */}
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
        {graphData.nodes.length === 1 ? (
          <div className="flex items-center justify-center h-[600px] text-gray-500">
            No network data to display. Start following users on GitHub!
          </div>
        ) : (
          <svg
            ref={svgRef}
            width="100%"
            height={600}
            style={{ background: '#111827', touchAction: 'none' }}
            onWheel={(e) => {
              e.preventDefault();
              const svg = svgRef.current;
              if (!svg) return;
              const delta = -e.deltaY;
              const zoomFactor = delta > 0 ? 1.08 : 1 / 1.08;
              const nextK = clamp(transform.k * zoomFactor, 0.1, 4);
              const before = svgPointToGraphPoint(svg, e.clientX, e.clientY, transform);
              const next: ViewTransform = {
                k: nextK,
                x: e.clientX - svg.getBoundingClientRect().left - before.x * nextK,
                y: e.clientY - svg.getBoundingClientRect().top - before.y * nextK,
              };
              setTransform(next);
            }}
            onPointerDown={(e) => {
              const svg = svgRef.current;
              if (!svg) return;
              (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
              interactionRef.current = {
                kind: 'pan',
                pointerId: e.pointerId,
                startX: e.clientX,
                startY: e.clientY,
                startT: transform,
              };
            }}
            onPointerMove={(e) => {
              const st = interactionRef.current;
              if (st.kind !== 'pan' || st.pointerId !== e.pointerId) return;
              const dx = e.clientX - st.startX;
              const dy = e.clientY - st.startY;
              setTransform({ ...st.startT, x: st.startT.x + dx, y: st.startT.y + dy });
            }}
            onPointerUp={(e) => {
              const st = interactionRef.current;
              if (st.kind === 'pan' && st.pointerId === e.pointerId) {
                interactionRef.current = { kind: 'none' };
              }
            }}
          >
            <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
              {/* Links */}
              {graphLinks.map((l) => {
                const s = nodeMapRef.current.get(l.source);
                const t = nodeMapRef.current.get(l.target);
                if (!s || !t) return null;
                return (
                  <line
                    key={`${l.source}->${l.target}:${l.type}`}
                    x1={s.x}
                    y1={s.y}
                    x2={t.x}
                    y2={t.y}
                    stroke="rgba(156, 163, 175, 0.3)"
                    strokeWidth={1}
                  />
                );
              })}

              {/* Nodes */}
              {graphNodes.map((n) => {
                const c = colors(n.type);
                const label = n.name;
                const fontSize = n.type === 'user' ? 12 : 10;

                return (
                  <g
                    key={n.id}
                    transform={`translate(${n.x},${n.y})`}
                    style={{ cursor: n.id === 'current-user' ? 'default' : 'pointer' }}
                    onClick={() => {
                      if (n.id !== 'current-user' && n.name) {
                        window.open(`https://github.com/${n.name}`, '_blank');
                      }
                    }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      const svg = svgRef.current;
                      if (!svg) return;
                      (svg as SVGSVGElement).setPointerCapture(e.pointerId);
                      interactionRef.current = {
                        kind: 'drag-node',
                        pointerId: e.pointerId,
                        nodeId: n.id,
                      };
                      const node = nodeMapRef.current.get(n.id);
                      if (node) {
                        node.isPinned = true;
                        node.vx = 0;
                        node.vy = 0;
                      }
                    }}
                    onPointerMove={(e) => {
                      const st = interactionRef.current;
                      if (
                        st.kind !== 'drag-node' ||
                        st.pointerId !== e.pointerId ||
                        st.nodeId !== n.id
                      )
                        return;
                      const svg = svgRef.current;
                      if (!svg) return;
                      const p = svgPointToGraphPoint(svg, e.clientX, e.clientY, transform);
                      const node = nodeMapRef.current.get(n.id);
                      if (!node) return;
                      node.x = p.x;
                      node.y = p.y;
                      node.vx = 0;
                      node.vy = 0;
                      setGraphNodes(
                        Array.from(nodeMapRef.current.values()).map((nn) => ({ ...nn }))
                      );
                    }}
                    onPointerUp={(e) => {
                      const st = interactionRef.current;
                      if (
                        st.kind !== 'drag-node' ||
                        st.pointerId !== e.pointerId ||
                        st.nodeId !== n.id
                      )
                        return;
                      interactionRef.current = { kind: 'none' };
                      const node = nodeMapRef.current.get(n.id);
                      if (!node) return;
                      if (n.id === 'current-user') return; // keep pinned
                      node.isPinned = false;
                    }}
                  >
                    <circle r={n.r} fill={c.fill} />
                    <text
                      x={0}
                      y={20}
                      textAnchor="middle"
                      fill={c.text}
                      fontSize={`${fontSize}px`}
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                    >
                      {label}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 text-sm text-gray-400">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-blue-500"></div>
          <span>You</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-green-500"></div>
          <span>Following ({following.length})</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-orange-500"></div>
          <span>Followers ({followers.length})</span>
        </div>
      </div>
    </div>
  );
}
