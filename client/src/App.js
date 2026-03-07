import './App.css';
import { React } from 'react'
import { BrowserRouter, Redirect, Route, Switch } from 'react-router-dom'
import { AuthContextProvider } from './auth';
import {
    AppBanner,
    CommissionerHomeScreen,
    CommissionerLeagueScreen,
    DraftRoomScreen,
    ForgotPasswordScreen,
    HomeWrapper,
    LoginScreen,
    PlayerHomeScreen,
    RegisterScreen
} from './components'

const App = () => {   
    return (
        <BrowserRouter>
            <AuthContextProvider>
                <div className="app-shell">
                    <AppBanner />
                    <Switch>
                        <Route path="/" exact component={HomeWrapper} />
                        <Route path="/login" exact component={LoginScreen} />
                        <Route path="/register" exact component={RegisterScreen} />
                        <Route path="/forgot-password" exact component={ForgotPasswordScreen} />
                        <Route path="/player-home" exact component={PlayerHomeScreen} />
                        <Route path="/commissioner-home" exact component={CommissionerHomeScreen} />
                        <Route path="/commissioner-home/league/:leagueId" exact component={CommissionerLeagueScreen} />
                        <Route path="/league/:leagueId/draft-room" exact component={DraftRoomScreen} />
                        <Redirect to="/" />
                    </Switch>
                </div>
            </AuthContextProvider>
        </BrowserRouter>
    )
}

export default App
