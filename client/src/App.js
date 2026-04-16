import './App.css';
import { React } from 'react'
import { BrowserRouter, Redirect, Route, Switch } from 'react-router-dom'
import { AuthContextProvider } from './auth';
import GlobalStoreContextProvider from './store';
import {
    AppBanner,
    DraftSessionSetupScreen,
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
                <GlobalStoreContextProvider>
                <div className="app-shell">
                    <AppBanner />
                    <Switch>
                        <Route path="/" exact component={HomeWrapper} />
                        <Route path="/home" exact component={PlayerHomeScreen} />
                        <Route path="/login" exact component={LoginScreen} />
                        <Route path="/register" exact component={RegisterScreen} />
                        <Route path="/forgot-password" exact component={ForgotPasswordScreen} />
                        <Route path="/league/:leagueId/draft/:draftSessionId/setup" exact component={DraftSessionSetupScreen} />
                        <Route path="/league/:leagueId/draft-room/:draftSessionId" exact component={DraftRoomScreen} />
                        <Route path="/league/:leagueId/draft-room" exact component={DraftRoomScreen} />
                        <Redirect to="/" />
                    </Switch>
                </div>
                </GlobalStoreContextProvider>
            </AuthContextProvider>
        </BrowserRouter>
    )
}

export default App
