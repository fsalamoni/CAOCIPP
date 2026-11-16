/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import { lazy } from 'react';
// Cada página vira um pedaço próprio do pacote, baixado só quando a pessoa a
// abre (antes, todo o SIGO vinha num arquivo único de ~6 MB na primeira visita).
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Help = lazy(() => import('./pages/Help'));
const Landing = lazy(() => import('./pages/Landing'));
const Organization = lazy(() => import('./pages/Organization'));
const Profile = lazy(() => import('./pages/Profile'));
const Terms = lazy(() => import('./pages/Terms'));
const Admin = lazy(() => import('./pages/Admin'));
const Secretaria = lazy(() => import('./pages/Secretaria'));
const ProcessoEletronico = lazy(() => import('./pages/ProcessoEletronico'));
const Portal = lazy(() => import('./pages/Portal'));
const Disputas = lazy(() => import('./pages/Disputas'));
const MeusProcessosEletronicos = lazy(() => import('./pages/MeusProcessosEletronicos'));
const Conferir = lazy(() => import('./pages/Conferir'));
import __Layout from './Layout.jsx';


export const PAGES = {
    "Dashboard": Dashboard,
    "Help": Help,
    "Landing": Landing,
    "Organization": Organization,
    "Profile": Profile,
    "Terms": Terms,
    "Admin": Admin,
    "ProcessoEletronico": ProcessoEletronico,
    "Secretaria": Secretaria,
    "Portal": Portal,
    "Disputas": Disputas,
    "MeusProcessosEletronicos": MeusProcessosEletronicos,
    "Conferir": Conferir,
}

export const pagesConfig = {
    mainPage: "Landing",
    Pages: PAGES,
    Layout: __Layout,
};