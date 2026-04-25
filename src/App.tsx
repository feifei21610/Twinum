/**
 * Twinum App 根组件
 *
 * 简易路由：根据 gameStore.route 切换页面。
 * 页面：start / game / result / rules / online
 */
import { useGameStore, selectRoute } from './store/gameStore';
import { StartPage } from './pages/StartPage';
import { GamePage } from './pages/GamePage';
import { ResultPagePlaceholder } from './pages/ResultPage';
import { RulesPagePlaceholder } from './pages/RulesPage';
import { OnlineLobbyPage } from './pages/OnlineLobbyPage';

function App(): JSX.Element {
  const route = useGameStore(selectRoute);

  switch (route) {
    case 'start':
      return <StartPage />;
    case 'game':
      return <GamePage />;
    case 'result':
      return <ResultPagePlaceholder />;
    case 'rules':
      return <RulesPagePlaceholder />;
    case 'online':
      return <OnlineLobbyPage />;
    default:
      return <StartPage />;
  }
}

export default App;
