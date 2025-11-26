import type { Resource } from '../api/client';
import './ResourcesList.css';

interface ResourcesListProps {
    resources: Resource[];
    isLoading: boolean;
    searchTerm: string;
    onSearchChange: (term: string) => void;
}

export const ResourcesList = ({ resources, isLoading, searchTerm, onSearchChange }: ResourcesListProps) => {
    const filteredResources = resources.filter(resource =>
        resource.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        resource.type.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getResourceTypeColor = (type: string) => {
        switch (type) {
            case 'gke': return 'badge-primary';
            case 'vm': return 'badge-success';
            case 'cloudrun': return 'badge-warning';
            default: return 'badge-error';
        }
    };

    const getResourceIcon = (type: string) => {
        switch (type) {
            case 'gke': return '⚙️';
            case 'vm': return '💻';
            case 'cloudrun': return '🚀';
            default: return '📦';
        }
    };

    const groupedResources = filteredResources.reduce((acc, resource) => {
        if (!acc[resource.type]) {
            acc[resource.type] = [];
        }
        acc[resource.type].push(resource);
        return acc;
    }, {} as Record<string, Resource[]>);

    if (isLoading) {
        return (
            <div className="resources-list-container">
                <div className="loading-container">
                    <div className="loading-spinner"></div>
                    <p>Loading resources...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="resources-list-container fade-in">
            <div className="resources-list-header">
                <div>
                    <h2>GCP Resources</h2>
                    <p className="resources-count">{filteredResources.length} total</p>
                </div>
                <input
                    type="text"
                    className="input search-input"
                    placeholder="Search resources..."
                    value={searchTerm}
                    onChange={(e) => onSearchChange(e.target.value)}
                />
            </div>

            {Object.entries(groupedResources).map(([type, typeResources]) => (
                <div key={type} className="resource-group">
                    <div className="resource-group-header">
                        <h3>
                            <span className="resource-group-icon">{getResourceIcon(type)}</span>
                            {type.toUpperCase()}
                            <span className="resource-group-count">({typeResources.length})</span>
                        </h3>
                    </div>

                    <div className="resources-grid">
                        {typeResources.map((resource, index) => (
                            <div key={index} className="resource-card card">
                                <div className="resource-card-header">
                                    <div className="resource-icon">
                                        {getResourceIcon(resource.type)}
                                    </div>
                                    <div className="resource-info">
                                        <h4 className="resource-name">{resource.name}</h4>
                                        <span className={`badge ${getResourceTypeColor(resource.type)}`}>
                                            {resource.type}
                                        </span>
                                    </div>
                                </div>
                                <div className="resource-meta">
                                    <div className="meta-item">
                                        <span className="meta-label">Location:</span>
                                        <span className="meta-value">{resource.location}</span>
                                    </div>
                                    <div className="meta-item">
                                        <span className="meta-label">IAM Roles:</span>
                                        <span className="meta-value">{Object.keys(resource.iam).length}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}

            {filteredResources.length === 0 && (
                <div className="empty-state">
                    <p>No resources found matching "{searchTerm}"</p>
                </div>
            )}
        </div>
    );
};
