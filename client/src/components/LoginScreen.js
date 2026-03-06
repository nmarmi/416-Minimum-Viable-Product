import { useContext } from 'react';
import { Link } from 'react-router-dom';
import AuthContext from '../auth';
import MUIErrorModal from './MUIErrorModal';

import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CssBaseline from '@mui/material/CssBaseline';
import Grid from '@mui/material/Grid';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

export default function LoginScreen() {
    const { auth } = useContext(AuthContext);

    const handleSubmit = async (event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        await auth.loginUser(
            formData.get('email'),
            formData.get('password')
        );
    };

    return (
        <Grid container component="main" sx={{ minHeight: 'calc(100vh - 64px)' }}>
            <CssBaseline />
            <Grid
                item
                xs={false}
                md={7}
                className="auth-side-panel"
            />
            <Grid item xs={12} md={5} component={Paper} elevation={4} square>
                <Box
                    sx={{
                        my: 8,
                        mx: 4,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                    }}
                >
                    <Avatar sx={{ m: 1, bgcolor: 'primary.main' }}>
                        <LockOutlinedIcon />
                    </Avatar>
                    <Typography component="h1" variant="h5">
                        Sign in
                    </Typography>
                    <Box component="form" noValidate onSubmit={handleSubmit} sx={{ mt: 2, width: '100%' }}>
                        <TextField
                            margin="normal"
                            required
                            fullWidth
                            id="email"
                            label="Email Address"
                            name="email"
                            autoComplete="email"
                            autoFocus
                        />
                        <TextField
                            margin="normal"
                            required
                            fullWidth
                            name="password"
                            label="Password"
                            type="password"
                            id="password"
                            autoComplete="current-password"
                        />
                        <Button
                            type="submit"
                            fullWidth
                            variant="contained"
                            sx={{ mt: 3, mb: 2 }}
                        >
                            Sign In
                        </Button>
                        <Typography variant="body2">
                            Don&apos;t have an account? <Link to="/register">Sign up</Link>
                        </Typography>
                    </Box>
                </Box>
            </Grid>
            <MUIErrorModal />
        </Grid>
    );
}
