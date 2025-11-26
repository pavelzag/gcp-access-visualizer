import { useState } from 'react';
import type { AccessMatrix } from '../api/client';
import './NetworkGraph.css';

interface NetworkGraphProps {
    data: AccessMatrix | null;
    isLoading: boolean;
}

interface GraphNode {
    id: string;
    name: string;
    type: 'user' | 'resource';
    resourceType?: string;
    userType?: string;
    val: number;
    connections?: Array<{
        name: string;
        roles: string[];
    }>;
}

interface GraphLink {
    source: string;
    target: string;
    roles: string[];
}



export const NetworkGraph = ({ data, isLoading }: NetworkGraphProps) => {
    const [filterType, setFilterType] = useState<'none' | 'user' | 'resource'>('none');
    const [selectedFilter, setSelectedFilter] = useState<string>('');
    const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
    const [selectedLink, setSelectedLink] = useState<GraphLink | null>(null);
    const [showNodeType, setShowNodeType] = useState<'all' | 'users' | 'resources'>('all');


    // Zoom & Pan State
    const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        const scaleAmount = -e.deltaY * 0.001;
        const newScale = Math.min(Math.max(0.1, transform.k * (1 + scaleAmount)), 4);

        // Zoom towards mouse pointer
        // For simplicity in this implementation, we'll zoom towards center or just scale
        // A proper d3-zoom implementation would handle the matrix math for pointer-based zoom
        // Here we just scale

        setTransform(prev => ({
            ...prev,
            k: newScale
        }));
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        setDragStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging) return;
        setTransform(prev => ({
            ...prev,
            x: e.clientX - dragStart.x,
            y: e.clientY - dragStart.y
        }));
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    const handleZoomIn = () => setTransform(prev => ({ ...prev, k: Math.min(prev.k * 1.2, 4) }));
    const handleZoomOut = () => setTransform(prev => ({ ...prev, k: Math.max(prev.k / 1.2, 0.1) }));
    const handleResetZoom = () => setTransform({ x: 0, y: 0, k: 1 });

    const handleLinkClick = (link: GraphLink, e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedLink(link);
    };

    if (isLoading || !data) {
        return (
            <div className="network-graph-container">
                <div className="loading-container">
                    <div className="loading-spinner"></div>
                    <p>Loading network graph...</p>
                </div>
            </div>
        );
    }

    // Build graph data
    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];

    // Add user nodes
    data.users.forEach(user => {
        nodes.push({
            id: `user::${user.email}`,
            name: user.email,
            type: 'user',
            userType: user.type,
            val: 8,
        });
    });

    // Add resource nodes
    data.resources.forEach(resource => {
        nodes.push({
            id: `resource::${resource.id}`,
            name: resource.name,
            type: 'resource',
            resourceType: resource.type,
            val: 10,
        });
    });

    // Add links (access relationships)
    data.access.forEach(entry => {
        links.push({
            source: `user::${entry.userEmail}`,
            target: `resource::${entry.resourceId}`,
            roles: entry.roles,
        });
    });

    console.log('==== DATA DEBUG ====');
    console.log('Total users:', data.users.length);
    console.log('Total resources:', data.resources.length);
    console.log('Total access entries:', data.access.length);
    console.log('Generated links:', links.length);
    console.log('Sample link:', links[0]);
    console.log('Sample user node:', nodes.find(n => n.type === 'user'));
    console.log('Sample resource node:', nodes.find(n => n.type === 'resource'));
    console.log('All link sources:', [...new Set(links.map(l => l.source))]);
    console.log('All user node IDs:', nodes.filter(n => n.type === 'user').map(n => n.id));
    console.log('==================');

    // Apply filtering
    let filteredNodes = nodes;
    let filteredLinks = links;

    // First, filter by node type visibility
    if (showNodeType === 'users') {
        filteredNodes = nodes.filter(n => n.type === 'user');
    } else if (showNodeType === 'resources') {
        filteredNodes = nodes.filter(n => n.type === 'resource');
    }
    // else: 'all' mode - show everything, no filtering needed


    // Then apply user/resource specific filters
    if (filterType !== 'none' && selectedFilter) {
        if (filterType === 'user') {
            const userId = `user::${selectedFilter}`;
            // Show only the selected user and resources they have access to
            const connectedResourceIds = new Set(
                links.filter(l => l.source === userId).map(l => l.target)
            );
            filteredNodes = nodes.filter(
                n => n.id === userId || connectedResourceIds.has(n.id)
            );
            filteredLinks = links.filter(l => l.source === userId);
        } else if (filterType === 'resource') {
            const resourceId = `resource::${selectedFilter}`;
            // Show only the selected resource and users who have access to it
            const connectedUserIds = new Set(
                links.filter(l => l.target === resourceId).map(l => l.source)
            );
            filteredNodes = nodes.filter(
                n => n.id === resourceId || connectedUserIds.has(n.id)
            );
            filteredLinks = links.filter(l => l.target === resourceId);
        }
    }

    // CRITICAL: Ensure all links reference existing nodes
    // This prevents "node not found" errors in the force graph
    const nodeIds = new Set(filteredNodes.map(n => n.id));
    filteredLinks = filteredLinks.filter(link =>
        nodeIds.has(link.source) && nodeIds.has(link.target)
    );

    console.log('Nodes:', filteredNodes.length, 'Links:', filteredLinks.length);
    console.log('Node IDs:', Array.from(nodeIds));
    console.log('Links:', filteredLinks.map(l => ({ source: l.source, target: l.target })));

    const handleNodeClick = (node: any) => {
        const nodeId = node.id;
        const nodeData = nodes.find(n => n.id === nodeId);
        if (!nodeData) return;

        console.log('Clicked node:', nodeId, 'Type:', nodeData.type);
        console.log('Total links:', links.length);

        // Get connections for this node using the ORIGINAL links array (not mutated)
        const connections: Array<{ name: string; roles: string[] }> = [];

        if (nodeData.type === 'user') {
            // Find all resources this user has access to
            const userLinks = links.filter(l => l.source === nodeId);
            console.log('User links found:', userLinks.length, userLinks);

            userLinks.forEach(link => {
                const resource = nodes.find(n => n.id === link.target);
                if (resource) {
                    connections.push({
                        name: resource.name,
                        roles: link.roles,
                    });
                }
            });
        } else {
            // Find all users who have access to this resource
            const resourceLinks = links.filter(l => l.target === nodeId);
            console.log('Resource links found:', resourceLinks.length, resourceLinks);

            resourceLinks.forEach(link => {
                const user = nodes.find(n => n.id === link.source);
                if (user) {
                    connections.push({
                        name: user.name,
                        roles: link.roles,
                    });
                }
            });
        }

        console.log('Connections found:', connections.length, connections);

        setSelectedNode({
            id: node.id,
            name: node.name,
            type: node.type,
            val: node.val,
            connections: connections
        });
    };


    const getNodeColor = (node: GraphNode) => {
        if (node.type === 'user') {
            switch (node.userType) {
                case 'user': return '#6366f1';
                case 'serviceAccount': return '#10b981';
                case 'group': return '#f59e0b';
                default: return '#8b5cf6';
            }
        } else {
            switch (node.resourceType) {
                case 'gke': return '#6366f1';
                case 'vm': return '#10b981';
                case 'cloudrun': return '#f59e0b';
                default: return '#ec4899';
            }
        }
    };

    return (
        <div className="network-graph-container fade-in">
            <div className="network-graph-header">
                <div className="header-row">
                    <h2>Access Network Graph</h2>

                    <div className="controls-wrapper">
                        <div className="filter-controls">
                            {/* Node type visibility toggle */}
                            <div className="toggle-group">
                                <button
                                    className={`toggle-button ${showNodeType === 'all' ? 'active' : ''}`}
                                    onClick={() => setShowNodeType('all')}
                                >
                                    🌐 All
                                </button>
                                <button
                                    className={`toggle-button ${showNodeType === 'users' ? 'active' : ''}`}
                                    onClick={() => setShowNodeType('users')}
                                >
                                    👤 Users Only
                                </button>
                                <button
                                    className={`toggle-button ${showNodeType === 'resources' ? 'active' : ''}`}
                                    onClick={() => setShowNodeType('resources')}
                                >
                                    📦 Resources Only
                                </button>
                            </div>

                            <select
                                className="input filter-select"
                                value={filterType}
                                onChange={(e) => {
                                    setFilterType(e.target.value as 'none' | 'user' | 'resource');
                                    setSelectedFilter('');
                                }}
                            >
                                <option value="none">Show All</option>
                                <option value="user">Filter by User</option>
                                <option value="resource">Filter by Resource</option>
                            </select>

                            {filterType === 'user' && (
                                <select
                                    className="input filter-select"
                                    value={selectedFilter}
                                    onChange={(e) => setSelectedFilter(e.target.value)}
                                >
                                    <option value="">Select a user...</option>

                                    {/* Group users by type */}
                                    {(() => {
                                        const usersByType = {
                                            user: data.users.filter(u => u.type === 'user'),
                                            serviceAccount: data.users.filter(u => u.type === 'serviceAccount'),
                                            group: data.users.filter(u => u.type === 'group'),
                                            other: data.users.filter(u => !['user', 'serviceAccount', 'group'].includes(u.type)),
                                        };

                                        return (
                                            <>
                                                {usersByType.user.length > 0 && (
                                                    <optgroup label={`👤 Users (${usersByType.user.length})`}>
                                                        {usersByType.user.map((user, idx) => (
                                                            <option key={idx} value={user.email}>{user.email}</option>
                                                        ))}
                                                    </optgroup>
                                                )}

                                                {usersByType.serviceAccount.length > 0 && (
                                                    <optgroup label={`🔧 Service Accounts (${usersByType.serviceAccount.length})`}>
                                                        {usersByType.serviceAccount.map((user, idx) => (
                                                            <option key={idx} value={user.email}>{user.email}</option>
                                                        ))}
                                                    </optgroup>
                                                )}

                                                {usersByType.group.length > 0 && (
                                                    <optgroup label={`👥 Groups (${usersByType.group.length})`}>
                                                        {usersByType.group.map((user, idx) => (
                                                            <option key={idx} value={user.email}>{user.email}</option>
                                                        ))}
                                                    </optgroup>
                                                )}

                                                {usersByType.other.length > 0 && (
                                                    <optgroup label={`📋 Other (${usersByType.other.length})`}>
                                                        {usersByType.other.map((user, idx) => (
                                                            <option key={idx} value={user.email}>{user.email}</option>
                                                        ))}
                                                    </optgroup>
                                                )}
                                            </>
                                        );
                                    })()}
                                </select>
                            )}

                            {filterType === 'resource' && (
                                <select
                                    className="input filter-select"
                                    value={selectedFilter}
                                    onChange={(e) => setSelectedFilter(e.target.value)}
                                >
                                    <option value="">Select a resource...</option>
                                    {data.resources.map((resource, idx) => (
                                        <option key={idx} value={resource.id}>{resource.name} ({resource.type})</option>
                                    ))}
                                </select>
                            )}
                        </div>


                    </div>
                </div>


            </div>

            <div className="graph-wrapper card">
                <div className="zoom-controls">
                    <button onClick={handleZoomIn} title="Zoom In">+</button>
                    <button onClick={handleZoomOut} title="Zoom Out">-</button>
                    <button onClick={handleResetZoom} title="Reset View">⟲</button>
                </div>
                {(() => {
                    const width = 1000;
                    const leftX = 250;
                    const rightX = width - 250;
                    const nodeRadius = 6;
                    const nodeSpacing = 35;
                    const groupSpacing = 40;
                    const startY = 80;

                    // 1. Group and sort nodes
                    const userNodes = filteredNodes.filter(n => n.type === 'user');
                    const resourceNodes = filteredNodes.filter(n => n.type === 'resource');

                    const groupNodes = (nodes: GraphNode[], getGroup: (n: GraphNode) => string) => {
                        const groups: { [key: string]: GraphNode[] } = {};
                        nodes.forEach(n => {
                            const group = getGroup(n);
                            if (!groups[group]) groups[group] = [];
                            groups[group].push(n);
                        });
                        return groups;
                    };

                    const userGroups = groupNodes(userNodes, n => {
                        if (n.userType === 'user') return 'Users';
                        if (n.userType === 'serviceAccount') return 'Service Accounts';
                        if (n.userType === 'group') return 'Groups';
                        return 'Other';
                    });

                    const resourceGroups = groupNodes(resourceNodes, n => {
                        if (n.resourceType === 'gke') return 'GKE Clusters';
                        if (n.resourceType === 'vm') return 'Virtual Machines';
                        if (n.resourceType === 'cloudrun') return 'Cloud Run';
                        if (n.resourceType === 'storage') return 'Storage';
                        if (n.resourceType === 'bigquery') return 'BigQuery';
                        if (n.resourceType === 'project') return 'Projects';
                        if (n.resourceType === 'serviceaccount') return 'Service Accounts (Resource)';
                        return 'Other Resources';
                    });

                    // 2. Calculate positions and total height
                    let userY = startY;
                    const userPositions: any[] = [];
                    const userGroupLabels: any[] = [];

                    ['Users', 'Groups', 'Service Accounts', 'Other'].forEach(groupName => {
                        const groupNodes = userGroups[groupName] || [];
                        if (groupNodes.length === 0) return;

                        userGroupLabels.push({ y: userY, text: groupName });
                        userY += 25;

                        groupNodes.sort((a, b) => a.name.localeCompare(b.name));

                        groupNodes.forEach(node => {
                            userPositions.push({ ...node, x: leftX, y: userY });
                            userY += nodeSpacing;
                        });
                        userY += groupSpacing;
                    });

                    let resourceY = startY;
                    const resourcePositions: any[] = [];
                    const resourceGroupLabels: any[] = [];

                    Object.keys(resourceGroups).sort().forEach(groupName => {
                        const groupNodes = resourceGroups[groupName] || [];
                        if (groupNodes.length === 0) return;

                        resourceGroupLabels.push({ y: resourceY, text: groupName });
                        resourceY += 25;

                        groupNodes.sort((a, b) => a.name.localeCompare(b.name));

                        groupNodes.forEach(node => {
                            resourcePositions.push({ ...node, x: rightX, y: resourceY });
                            resourceY += nodeSpacing;
                        });
                        resourceY += groupSpacing;
                    });

                    // 3. Determine SVG height
                    const totalHeight = Math.max(600, Math.max(userY, resourceY) + 50);

                    // 4. Create lookups and helpers
                    const nodePositionMap = new Map();
                    userPositions.forEach(n => nodePositionMap.set(n.id, n));
                    resourcePositions.forEach(n => nodePositionMap.set(n.id, n));

                    const getLinkGradient = (roles: string[]) => {
                        if (roles.some(r => r.includes('owner') || r.includes('admin'))) {
                            return 'url(#ownerGradient)';
                        }
                        if (roles.some(r => r.includes('editor') || r.includes('write'))) {
                            return 'url(#editorGradient)';
                        }
                        return 'url(#viewerGradient)';
                    };

                    return (
                        <svg
                            width="100%"
                            height={totalHeight}
                            className="bipartite-graph"
                            onMouseDown={handleMouseDown}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            onMouseLeave={handleMouseUp}
                            onWheel={handleWheel}
                            style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
                        >
                            <defs>
                                <linearGradient id="ownerGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                    <stop offset="0%" stopColor="rgba(239, 68, 68, 0.6)" />
                                    <stop offset="100%" stopColor="rgba(239, 68, 68, 0.1)" />
                                </linearGradient>
                                <linearGradient id="editorGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                    <stop offset="0%" stopColor="rgba(245, 158, 11, 0.6)" />
                                    <stop offset="100%" stopColor="rgba(245, 158, 11, 0.1)" />
                                </linearGradient>
                                <linearGradient id="viewerGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                    <stop offset="0%" stopColor="rgba(99, 102, 241, 0.6)" />
                                    <stop offset="100%" stopColor="rgba(99, 102, 241, 0.1)" />
                                </linearGradient>
                            </defs>

                            <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
                                {/* Draw connections first (behind nodes) */}
                                <g className="connections">
                                    {filteredLinks.map((link, i) => {
                                        const source = nodePositionMap.get(link.source);
                                        const target = nodePositionMap.get(link.target);
                                        if (!source || !target) return null;

                                        const path = `M ${source.x + nodeRadius} ${source.y} 
                                                      C ${source.x + 150} ${source.y}, 
                                                        ${target.x - 150} ${target.y}, 
                                                        ${target.x - nodeRadius} ${target.y}`;

                                        return (
                                            <g key={i} onClick={(e) => handleLinkClick(link, e)} style={{ cursor: 'pointer' }}>
                                                {/* Invisible wider path for easier clicking */}
                                                <path
                                                    d={path}
                                                    stroke="transparent"
                                                    strokeWidth={10}
                                                    fill="none"
                                                />
                                                {/* Visible path */}
                                                <path
                                                    d={path}
                                                    stroke={getLinkGradient(link.roles)}
                                                    strokeWidth={1.5}
                                                    fill="none"
                                                    opacity={0.6}
                                                >
                                                    <title>{link.roles.join(', ')}</title>
                                                </path>
                                            </g>
                                        );
                                    })}
                                </g>

                                {/* Draw User Group Labels */}
                                <g className="group-labels">
                                    {userGroupLabels.map((label, i) => (
                                        <text key={`ul-${i}`} x={leftX} y={label.y} textAnchor="end" fill="var(--text-secondary)" fontSize="12" fontWeight="700" style={{ textTransform: 'uppercase', letterSpacing: '1px' }}>
                                            {label.text}
                                        </text>
                                    ))}
                                </g>

                                {/* Draw Resource Group Labels */}
                                <g className="group-labels">
                                    {resourceGroupLabels.map((label, i) => (
                                        <text key={`rl-${i}`} x={rightX} y={label.y} textAnchor="start" fill="var(--text-secondary)" fontSize="12" fontWeight="700" style={{ textTransform: 'uppercase', letterSpacing: '1px' }}>
                                            {label.text}
                                        </text>
                                    ))}
                                </g>

                                {/* Draw user nodes */}
                                <g className="user-nodes">
                                    {userPositions.map((node) => (
                                        <g
                                            key={node.id}
                                            className="node user-node"
                                            onClick={() => handleNodeClick(node)}
                                            style={{ cursor: 'pointer' }}
                                        >
                                            <circle
                                                cx={node.x}
                                                cy={node.y}
                                                r={nodeRadius}
                                                fill={getNodeColor(node)}
                                                stroke="#fff"
                                                strokeWidth={2}
                                            />
                                            <text
                                                x={node.x - 15}
                                                y={node.y + 4}
                                                textAnchor="end"
                                                fill="var(--text-primary)"
                                                fontSize="12"
                                                fontWeight="500"
                                            >
                                                {node.name.length > 35 ? node.name.substring(0, 35) + '...' : node.name}
                                            </text>
                                        </g>
                                    ))}
                                </g>

                                {/* Draw resource nodes */}
                                <g className="resource-nodes">
                                    {resourcePositions.map((node) => (
                                        <g
                                            key={node.id}
                                            className="node resource-node"
                                            onClick={() => handleNodeClick(node)}
                                            style={{ cursor: 'pointer' }}
                                        >
                                            <circle
                                                cx={node.x}
                                                cy={node.y}
                                                r={nodeRadius}
                                                fill={getNodeColor(node)}
                                                stroke="#fff"
                                                strokeWidth={2}
                                            />
                                            <text
                                                x={node.x + 15}
                                                y={node.y + 4}
                                                textAnchor="start"
                                                fill="var(--text-primary)"
                                                fontSize="12"
                                                fontWeight="500"
                                            >
                                                {node.name.length > 35 ? node.name.substring(0, 35) + '...' : node.name}
                                            </text>
                                        </g>
                                    ))}
                                </g>

                                {/* Column headers */}
                                <text x={leftX} y={30} textAnchor="end" fill="var(--accent-primary)" fontSize="16" fontWeight="800">
                                    PRINCIPALS
                                </text>
                                <text x={rightX} y={30} textAnchor="start" fill="var(--accent-primary)" fontSize="16" fontWeight="800">
                                    RESOURCES
                                </text>
                            </g>
                        </svg>
                    );
                })()}
            </div>

            {/* Link Details Modal */}
            {selectedLink && (
                <div className="modal-overlay" onClick={() => setSelectedLink(null)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Access Details</h3>
                            <button className="modal-close" onClick={() => setSelectedLink(null)}>×</button>
                        </div>
                        <div className="modal-body">
                            <div className="detail-row">
                                <span className="detail-label">User:</span>
                                <span className="detail-value">{selectedLink.source.split('::')[1]}</span>
                            </div>
                            <div className="detail-row">
                                <span className="detail-label">Resource:</span>
                                <span className="detail-value">{selectedLink.target.split('::')[1]}</span>
                            </div>
                            <div className="detail-section">
                                <h4>Roles & Permissions</h4>
                                <div className="roles-list">
                                    {selectedLink.roles.map((role, idx) => (
                                        <div key={idx} className="role-item">
                                            <span className="badge badge-primary">{role}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {selectedNode && (
                <div className="modal-overlay" onClick={() => setSelectedNode(null)}>
                    <div className="modal-content card" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <div>
                                <h3>{selectedNode.name}</h3>
                                <span className={`badge ${selectedNode.type === 'user' ? 'badge-primary' : 'badge-success'}`}>
                                    {selectedNode.type}
                                </span>
                            </div>
                            <button className="modal-close" onClick={() => setSelectedNode(null)}>
                                ✕
                            </button>
                        </div>

                        <div className="modal-body">
                            <h4>
                                {selectedNode.type === 'user'
                                    ? `Resources this user has access to (${selectedNode.connections?.length ?? 0})`
                                    : `Users with access to this resource (${selectedNode.connections?.length ?? 0})`
                                }
                            </h4>

                            {selectedNode.connections && selectedNode.connections.length > 0 ? (
                                <div className="connections-list">
                                    {selectedNode.connections.map((conn, idx) => (
                                        <div key={idx} className="connection-item card">
                                            <div className="connection-name">{conn.name}</div>
                                            <div className="connection-roles">
                                                {conn.roles.map((role, roleIdx) => (
                                                    <span key={roleIdx} className="badge badge-primary role-badge">
                                                        {role}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="no-connections">No connections found.</p>
                            )}
                        </div>
                    </div>
                </div>
            )}


        </div>
    );
};
