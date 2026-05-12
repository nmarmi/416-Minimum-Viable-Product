import { useContext, useState } from 'react';
import AuthContext from '../auth';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';

export default function AccountSettingsModal({ onClose, onSuccess }) {
    const { auth } = useContext(AuthContext);
    const [tab, setTab] = useState('password');
    const [error, setError] = useState(null);
    const [confirmDelete, setConfirmDelete] = useState(false);

    const handleChangePassword = async (e) => {
        e.preventDefault();
        setError(null);
        const form = new FormData(e.currentTarget);
        const result = await auth.changePassword(
            form.get('currentPassword'),
            form.get('newPassword'),
            form.get('newPasswordVerify')
        );
        if (result.success) {
            onSuccess('success', 'Password changed successfully.');
            onClose();
        } else {
            setError(result.errorMessage);
        }
    };

    const handleDeleteAccount = async () => {
        setError(null);
        const result = await auth.deleteAccount();
        if (!result.success) setError(result.errorMessage);
    };

    return (
        <div className="account-modal-overlay" onClick={onClose}>
            <div className="account-modal-card" onClick={(e) => e.stopPropagation()}>
                <div className="account-modal-header">
                    <h2>Account Settings</h2>
                    <button className="account-modal-close" onClick={onClose} aria-label="close">
                        <CloseRoundedIcon sx={{ fontSize: 20 }} />
                    </button>
                </div>

                <div className="account-modal-tabs">
                    <button
                        className={`account-tab-btn${tab === 'password' ? ' active' : ''}`}
                        onClick={() => { setTab('password'); setError(null); }}
                    >
                        <LockOutlinedIcon sx={{ fontSize: 16 }} /> Change Password
                    </button>
                    <button
                        className={`account-tab-btn danger${tab === 'delete' ? ' active' : ''}`}
                        onClick={() => { setTab('delete'); setError(null); setConfirmDelete(false); }}
                    >
                        <DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} /> Delete Account
                    </button>
                </div>

                {tab === 'password' && (
                    <form className="account-modal-form" onSubmit={handleChangePassword} noValidate>
                        <label className="account-modal-label">Current Password</label>
                        <input name="currentPassword" type="password" className="account-modal-input" autoComplete="current-password" required />

                        <label className="account-modal-label">New Password</label>
                        <input name="newPassword" type="password" className="account-modal-input" autoComplete="new-password" required />

                        <label className="account-modal-label">Confirm New Password</label>
                        <input name="newPasswordVerify" type="password" className="account-modal-input" autoComplete="new-password" required />

                        {error && <p className="account-modal-error">{error}</p>}

                        <button className="account-modal-submit" type="submit">Update Password</button>
                    </form>
                )}

                {tab === 'delete' && (
                    <div className="account-modal-delete-zone">
                        <p className="account-modal-delete-warning">
                            This will permanently delete your account and all associated data. This cannot be undone.
                        </p>
                        {!confirmDelete ? (
                            <button className="account-modal-danger-btn" onClick={() => setConfirmDelete(true)}>
                                Delete My Account
                            </button>
                        ) : (
                            <div className="account-modal-confirm-row">
                                <p className="account-modal-confirm-text">Are you sure?</p>
                                <button className="account-modal-danger-btn" onClick={handleDeleteAccount}>
                                    Yes, Delete
                                </button>
                                <button className="account-modal-cancel-btn" onClick={() => setConfirmDelete(false)}>
                                    Cancel
                                </button>
                            </div>
                        )}
                        {error && <p className="account-modal-error">{error}</p>}
                    </div>
                )}
            </div>
        </div>
    );
}
