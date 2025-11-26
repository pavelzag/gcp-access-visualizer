import type { User } from '../api/client';
import './UsersList.css';

interface UsersListProps {
    users: User[];
    isLoading: boolean;
    searchTerm: string;
    onSearchChange: (term: string) => void;
}

export const UsersList = ({ users, isLoading, searchTerm, onSearchChange }: UsersListProps) => {
    const filteredUsers = users.filter(user =>
        user.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getUserTypeColor = (type: string) => {
        switch (type) {
            case 'user': return 'badge-primary';
            case 'serviceAccount': return 'badge-success';
            case 'group': return 'badge-warning';
            default: return 'badge-error';
        }
    };

    const getUserTypeLabel = (type: string) => {
        switch (type) {
            case 'serviceAccount': return 'Service Account';
            case 'user': return 'User';
            case 'group': return 'Group';
            default: return type;
        }
    };

    if (isLoading) {
        return (
            <div className="users-list-container">
                <div className="loading-container">
                    <div className="loading-spinner"></div>
                    <p>Loading users...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="users-list-container fade-in">
            <div className="users-list-header">
                <div>
                    <h2>IAM Principals</h2>
                    <p className="users-count">{filteredUsers.length} total</p>
                </div>
                <input
                    type="text"
                    className="input search-input"
                    placeholder="Search users..."
                    value={searchTerm}
                    onChange={(e) => onSearchChange(e.target.value)}
                />
            </div>

            <div className="users-grid">
                {filteredUsers.map((user, index) => (
                    <div key={index} className="user-card card">
                        <div className="user-card-header">
                            <div className="user-icon">
                                {user.type === 'user' ? '👤' : user.type === 'serviceAccount' ? '🔧' : '👥'}
                            </div>
                            <div className="user-info">
                                <h4 className="user-email">{user.email}</h4>
                                <span className={`badge ${getUserTypeColor(user.type)}`}>
                                    {getUserTypeLabel(user.type)}
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {filteredUsers.length === 0 && (
                <div className="empty-state">
                    <p>No users found matching "{searchTerm}"</p>
                </div>
            )}
        </div>
    );
};
