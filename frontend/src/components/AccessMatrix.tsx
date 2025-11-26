import { useState } from 'react';
import type { AccessMatrix as AccessMatrixType } from '../api/client';
import './AccessMatrix.css';

interface AccessMatrixProps {
    data: AccessMatrixType | null;
    isLoading: boolean;
}

export const AccessMatrix = ({ data, isLoading }: AccessMatrixProps) => {
    const [selectedUserTypes, setSelectedUserTypes] = useState<Set<string>>(new Set(['user', 'serviceAccount', 'group']));

    // Dynamically get all unique resource types from the data
    const allResourceTypes = data ? Array.from(new Set(data.resources.map(r => r.type))) : [];

    // Initialize with all resource types selected
    const [selectedResourceTypes, setSelectedResourceTypes] = useState<Set<string>>(() =>
        data ? new Set(data.resources.map(r => r.type)) : new Set()
    );

    const [selectedCell, setSelectedCell] = useState<{ user: string; resource: string; roles: string[] } | null>(null);

    if (isLoading || !data) {
        return (
            <div className="access-matrix-container">
                <div className="loading-container">
                    <div className="loading-spinner"></div>
                    <p>Loading access matrix...</p>
                </div>
            </div>
        );
    }

    // Create a lookup map for quick access
    // The challenge: access entries use resourceId (full paths like //storage.googleapis.com/...)
    // but resources may have different IDs (numeric for VMs, full paths for others)
    // We need to match them by name when IDs don't match

    const accessMap = new Map<string, Set<string>>();
    const resourceIdMap = new Map<string, string>(); // Maps resource.id -> access entry resourceId

    console.log('==== ACCESS MATRIX DEBUG ====');
    console.log('Total access entries:', data.access.length);
    console.log('Sample access entry:', data.access[0]);
    console.log('Total resources:', data.resources.length);
    console.log('Sample resource:', data.resources[0]);

    // First, build the access map using the resourceId from access entries
    data.access.forEach(entry => {
        const key = `${entry.userEmail}::${entry.resourceId}`;
        if (!accessMap.has(key)) {
            accessMap.set(key, new Set());
        }
        entry.roles.forEach(role => accessMap.get(key)?.add(role));
    });

    // Build a mapping from resource.id to access entry resourceId
    // Match by resourceName or by checking if the access resourceId contains the resource name
    data.resources.forEach(resource => {
        // Try to find matching access entries
        const matchingEntry = data.access.find(entry => {
            // Direct ID match
            if (entry.resourceId === resource.id) return true;
            // Name match (for VMs and other resources)
            if (entry.resourceName === resource.name) return true;
            // Check if the access resourceId ends with the resource name (for Cloud Run, etc.)
            if (entry.resourceId.endsWith(resource.name)) return true;
            // Check if resource.id is contained in entry.resourceId
            if (entry.resourceId.includes(resource.id)) return true;
            return false;
        });

        if (matchingEntry) {
            resourceIdMap.set(resource.id, matchingEntry.resourceId);
        }
    });

    console.log('Access map size:', accessMap.size);
    console.log('Resource ID map size:', resourceIdMap.size);
    console.log('Access map keys (first 5):', Array.from(accessMap.keys()).slice(0, 5));
    console.log('Resource IDs (first 5):', data.resources.slice(0, 5).map(r => r.id));
    console.log('Resource ID mappings (first 5):', Array.from(resourceIdMap.entries()).slice(0, 5));
    console.log('============================');

    const hasAccess = (userEmail: string, resourceId: string) => {
        // First try direct lookup
        let key = `${userEmail}::${resourceId}`;
        let result = accessMap.get(key);

        // If not found, try using the mapped resourceId
        if (!result && resourceIdMap.has(resourceId)) {
            const mappedResourceId = resourceIdMap.get(resourceId)!;
            key = `${userEmail}::${mappedResourceId}`;
            result = accessMap.get(key);
        }

        if (userEmail === 'pavelz@metalbear.com' && result) {
            console.log(`✓ Found access for ${userEmail} to ${resourceId}:`, Array.from(result));
        }
        return result;
    };

    const getRoleColor = (roles: Set<string>) => {
        const rolesArray = Array.from(roles);
        if (rolesArray.some(r => r.includes('owner') || r.includes('admin'))) {
            return 'access-owner';
        }
        if (rolesArray.some(r => r.includes('editor') || r.includes('write'))) {
            return 'access-editor';
        }
        if (rolesArray.some(r => r.includes('viewer') || r.includes('read'))) {
            return 'access-viewer';
        }
        return 'access-other';
    };

    const toggleUserType = (type: string) => {
        const newSet = new Set(selectedUserTypes);
        if (newSet.has(type)) {
            newSet.delete(type);
        } else {
            newSet.add(type);
        }
        setSelectedUserTypes(newSet);
    };

    const toggleResourceType = (type: string) => {
        const newSet = new Set(selectedResourceTypes);
        if (newSet.has(type)) {
            newSet.delete(type);
        } else {
            newSet.add(type);
        }
        setSelectedResourceTypes(newSet);
    };

    const filteredUsers = data.users.filter(user => selectedUserTypes.has(user.type));
    const filteredResources = data.resources.filter(resource => selectedResourceTypes.has(resource.type));

    return (
        <div className="access-matrix-container fade-in">
            <div className="access-matrix-header">
                <div className="header-top">
                    <h2>Access Matrix</h2>
                    <div className="legend">
                        <div className="legend-item">
                            <div className="legend-color access-owner"></div>
                            <span>Owner/Admin</span>
                        </div>
                        <div className="legend-item">
                            <div className="legend-color access-editor"></div>
                            <span>Editor/Write</span>
                        </div>
                        <div className="legend-item">
                            <div className="legend-color access-viewer"></div>
                            <span>Viewer/Read</span>
                        </div>
                        <div className="legend-item">
                            <div className="legend-color access-other"></div>
                            <span>Other</span>
                        </div>
                        <div className="legend-item">
                            <div className="legend-color access-none"></div>
                            <span>No Access</span>
                        </div>
                    </div>
                </div>

                <div className="matrix-controls">
                    <div className="control-group">
                        <span className="control-label">Show Users:</span>
                        <div className="checkbox-group">
                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={selectedUserTypes.has('user')}
                                    onChange={() => toggleUserType('user')}
                                />
                                <span>Users</span>
                            </label>
                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={selectedUserTypes.has('serviceAccount')}
                                    onChange={() => toggleUserType('serviceAccount')}
                                />
                                <span>Service Accounts</span>
                            </label>
                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={selectedUserTypes.has('group')}
                                    onChange={() => toggleUserType('group')}
                                />
                                <span>Groups</span>
                            </label>
                        </div>
                    </div>

                    <div className="control-group">
                        <span className="control-label">Show Resources:</span>
                        <div className="checkbox-group">
                            {allResourceTypes.sort().map(type => {
                                // Create friendly display names for resource types
                                const getDisplayName = (type: string) => {
                                    const typeMap: { [key: string]: string } = {
                                        'gke': 'GKE',
                                        'vm': 'VM',
                                        'cloudrun': 'Cloud Run',
                                        'storage': 'Storage',
                                        'bigquery': 'BigQuery',
                                        'project': 'Projects',
                                        'serviceaccount': 'Service Accounts'
                                    };
                                    return typeMap[type] || type.charAt(0).toUpperCase() + type.slice(1);
                                };

                                return (
                                    <label key={type} className="checkbox-label">
                                        <input
                                            type="checkbox"
                                            checked={selectedResourceTypes.has(type)}
                                            onChange={() => toggleResourceType(type)}
                                        />
                                        <span>{getDisplayName(type)}</span>
                                    </label>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            <div className="matrix-wrapper">
                <div className="matrix-scroll">
                    <table className="access-table">
                        <thead>
                            <tr>
                                <th className="sticky-col">User / Resource</th>
                                {filteredResources.map((resource, idx) => (
                                    <th key={idx} className="resource-header">
                                        <div className="resource-header-content">
                                            <span className="resource-name" title={resource.name}>
                                                {resource.name}
                                            </span>
                                            <span className={`badge badge-${resource.type === 'gke' ? 'primary' : resource.type === 'vm' ? 'success' : resource.type === 'cloudrun' ? 'warning' : 'secondary'}`}>
                                                {resource.type}
                                            </span>
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.map((user, userIdx) => (
                                <tr key={userIdx}>
                                    <td className="sticky-col user-cell">
                                        <div className="user-cell-content">
                                            <span className="user-email" title={user.email}>
                                                {user.email}
                                            </span>
                                            <span className={`badge ${user.type === 'user' ? 'badge-primary' : user.type === 'serviceAccount' ? 'badge-success' : 'badge-warning'}`}>
                                                {user.type}
                                            </span>
                                        </div>
                                    </td>
                                    {filteredResources.map((resource, resourceIdx) => {
                                        const roles = hasAccess(user.email, resource.id);
                                        const hasAnyAccess = roles && roles.size > 0;

                                        return (
                                            <td
                                                key={resourceIdx}
                                                className={`access-cell ${hasAnyAccess ? getRoleColor(roles) : 'access-none'} ${hasAnyAccess ? 'clickable' : ''}`}
                                                title={hasAnyAccess ? 'Click for details' : 'No access'}
                                                onClick={() => {
                                                    if (hasAnyAccess) {
                                                        setSelectedCell({
                                                            user: user.email,
                                                            resource: resource.name,
                                                            roles: Array.from(roles)
                                                        });
                                                    }
                                                }}
                                            >
                                                {hasAnyAccess && (
                                                    <div className="access-indicator">
                                                        {roles.size}
                                                    </div>
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {data.access.length === 0 && (
                <div className="empty-state">
                    <p>No access data available</p>
                </div>
            )}

            {/* Access Details Modal */}
            {selectedCell && (
                <div className="modal-overlay" onClick={() => setSelectedCell(null)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Access Details</h3>
                            <button className="modal-close" onClick={() => setSelectedCell(null)}>×</button>
                        </div>
                        <div className="modal-body">
                            <div className="detail-row">
                                <span className="detail-label">User:</span>
                                <span className="detail-value">{selectedCell.user}</span>
                            </div>
                            <div className="detail-row">
                                <span className="detail-label">Resource:</span>
                                <span className="detail-value">{selectedCell.resource}</span>
                            </div>
                            <div className="detail-section">
                                <h4>Roles & Permissions</h4>
                                <div className="roles-list">
                                    {selectedCell.roles.map((role, idx) => (
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
        </div>
    );
};
