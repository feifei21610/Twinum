/**
 * Twinum App 根组件
 *
 * 简易路由：根据 gameStore.route 切换页面。
 * MVP 阶段 4 个页面：start / game / result / rules
 * （result / rules 为占位，放到 Todo 6 pages-assembly 实现）
 */
import { useGameStore, selectRoute } from './store/gameStore';
import { StartPage } from './pages/StartPage';
import { GamePage } from './pages/GamePage';
import { ResultPagePlaceholder } from './pages/ResultPage';
import { RulesPagePlaceholder } from './pages/RulesPage';

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
    default:
      return <StartPage />;
  }
}

export default App;
