import './lib/legacyCompat';
import React,{lazy,Suspense} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter,Routes,Route} from 'react-router-dom';
import SiteLayout from './components/SiteLayout';
import {StoreProvider} from './lib/store';
import {RemoteProvider} from './lib/remote';
import {initializePwa,registerServiceWorker} from './lib/pwa';
import {initializeTvNavigation} from './lib/tvNavigation';
import './styles.css';
import './hich-theme.css';
import './device.css';
import './features.css';
import './experience.css';

const Home=lazy(()=>import('./pages/Home'));
const Browse=lazy(()=>import('./pages/Browse'));
const Search=lazy(()=>import('./pages/Search'));
const Details=lazy(()=>import('./pages/Details'));
const Watch=lazy(()=>import('./pages/Watch'));
const Watchlist=lazy(()=>import('./pages/Watchlist'));
const PairRemote=lazy(()=>import('./pages/PairRemote'));
const PhoneRemote=lazy(()=>import('./pages/PhoneRemote'));

function PageLoader(){return <div className="route-loader" role="status"><span/><strong>Loading your next story…</strong></div>;}
function NotFound(){return <div className="content-width not-found"><h1>404</h1><p>The page you're looking for doesn't exist.</p><a className="button button-primary" href="/">Back to home</a></div>;}
class AppErrorBoundary extends React.Component{
  constructor(props){super(props);this.state={error:null};}
  static getDerivedStateFromError(error){return {error};}
  componentDidCatch(error,info){console.error('[app] Unhandled interface error',error,info);}
  render(){
    if(!this.state.error)return this.props.children;
    return <main className="app-crash" role="alert"><div><span>CINERA RECOVERY</span><h1>Something interrupted the app.</h1><p>Your saved list and watch progress are safe on this device. Reload Cinera to reconnect.</p><div><button className="button button-primary" onClick={()=>window.location.reload()}>Reload app</button><a className="button button-outline" href="/">Go home</a></div></div></main>;
  }
}
function App(){return <StoreProvider><BrowserRouter><RemoteProvider><SiteLayout><Suspense fallback={<PageLoader/>}><Routes>
  <Route path="/" element={<Home/>}/>
  <Route path="/movies" element={<Browse fixedKind="movie"/>}/>
  <Route path="/series" element={<Browse fixedKind="tv"/>}/>
  <Route path="/discover" element={<Browse/>}/>
  <Route path="/search" element={<Search/>}/>
  <Route path="/title/:kind/:id" element={<Details/>}/>
  <Route path="/watch/:kind/:id" element={<Watch/>}/>
  <Route path="/watchlist" element={<Watchlist/>}/>
  <Route path="/pair" element={<PairRemote/>}/>
  <Route path="/remote" element={<PhoneRemote/>}/>
  <Route path="*" element={<NotFound/>}/>
</Routes></Suspense></SiteLayout></RemoteProvider></BrowserRouter></StoreProvider>;}
initializePwa();
registerServiceWorker();
initializeTvNavigation();
createRoot(document.getElementById('root')).render(<AppErrorBoundary><App/></AppErrorBoundary>);
