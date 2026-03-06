import './App.css';
import { React } from 'react'
import { BrowserRouter, Redirect, Route, Switch } from 'react-router-dom'
import { AuthContextProvider } from './auth';
import {
    AppBanner,
    HomeWrapper,
    LoginScreen,
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
                        <Redirect to="/" />
                    </Switch>
                </div>
            </AuthContextProvider>
        </BrowserRouter>
    )
}

export default App
