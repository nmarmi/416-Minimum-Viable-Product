import { useHistory } from 'react-router-dom';
import AutoAwesomeMosaicRoundedIcon from '@mui/icons-material/AutoAwesomeMosaicRounded';
import ShowChartRoundedIcon from '@mui/icons-material/ShowChartRounded';
import ManageAccountsRoundedIcon from '@mui/icons-material/ManageAccountsRounded';
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded';
import TimelineRoundedIcon from '@mui/icons-material/TimelineRounded';
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';

const draftCards = [
    {
        title: 'Smart Player Search',
        description: 'Advanced filtering by position, team, stats, and more to find the perfect players for your roster.',
        icon: <AutoAwesomeMosaicRoundedIcon fontSize="small" />
    },
    {
        title: 'Real-Time Budget Tracking',
        description: 'Stay on top of your auction budget with live calculations and spending recommendations.',
        icon: <ShowChartRoundedIcon fontSize="small" />
    },
    {
        title: 'Team Monitoring',
        description: "Track your opponents' rosters, budgets, and draft strategies in real-time.",
        icon: <ManageAccountsRoundedIcon fontSize="small" />
    },
    {
        title: 'Live Auction Drafts',
        description: 'Seamless real-time draft experience with automatic roster and budget updates.',
        icon: <AccessTimeRoundedIcon fontSize="small" />
    },
    {
        title: 'Advanced Analytics',
        description: 'Leverage scarcity metrics, value projections, and statistical insights to gain an edge.',
        icon: <TimelineRoundedIcon fontSize="small" />
    }
];

const roleCards = [
    {
        title: 'Fantasy Players',
        description: 'Create your league and draft your championship team with powerful tools and insights.',
        icon: <EmojiEventsRoundedIcon fontSize="small" />
    },
    {
        title: 'System Admins',
        description: 'Monitor users, manage permissions, and maintain system health.',
        icon: <GroupsRoundedIcon fontSize="small" />
    }
];

export default function SplashScreen() {
    const history = useHistory();

    return (
        <div className="home-page">
            <section className="hero-section">
                <h1 className="hero-title">
                    Dominate Your Fantasy
                    <span>Baseball Draft</span>
                </h1>
                <p className="hero-subtitle">
                    The ultimate draft kit for fantasy baseball enthusiasts. Make smarter decisions with real-time analytics,
                    and comprehensive team management tools.
                </p>
                <div className="actions-row">
                    <button className="dark-btn" type="button" onClick={() => history.push('/login')}>
                        Sign In
                    </button>
                    <button className="light-btn" type="button" onClick={() => history.push('/register')}>
                        Create Account
                    </button>
                </div>
            </section>

            <section className="feature-section">
                <h2 className="section-title">Everything You Need to Win Your Draft</h2>
                <div className="feature-grid draft-grid">
                    {draftCards.map((card) => (
                        <article className="feature-card" key={card.title}>
                            <div className="card-icon">{card.icon}</div>
                            <h3>{card.title}</h3>
                            <p>{card.description}</p>
                        </article>
                    ))}
                </div>
            </section>

            <section className="feature-section">
                <h2 className="section-title">Built For Every Role</h2>
                <div className="feature-grid roles-grid">
                    {roleCards.map((card) => (
                        <article className="feature-card" key={card.title}>
                            <div className="card-icon">{card.icon}</div>
                            <h3>{card.title}</h3>
                            <p>{card.description}</p>
                        </article>
                    ))}
                </div>
            </section>

            <section className="bottom-cta">
                <h2>Ready to Build Your Championship Team?</h2>
                <p>Join thousands of fantasy managers who trust our platform for their draft day success.</p>
                <button className="light-btn cta-btn" type="button" onClick={() => history.push('/register')}>
                    Get Started Now
                </button>
            </section>
        </div>
    );
}
