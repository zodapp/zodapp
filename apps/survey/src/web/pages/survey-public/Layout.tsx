import CommonLayout from "../../components/CommonLayout";
import { AuthGuard } from "../../shared/auth";
import { surveyDemo } from "../../shared/demos";

/**
 * 回答者向けの画面のレイアウト。
 *
 * 回答ページは管理画面ではないので、アンケート一覧・回答一覧といった
 * 管理用のサイドバーを出さない（`navItems` を渡さないと CommonLayout は
 * サイドバーごと描画しない）。共通ヘッダーだけを引き継ぐ。
 *
 * 認証は残している。回答の作成（responses.create）の authorize が、
 * ワークスペースのメンバーであることを求めるため（src/shared/tables/response.ts）。
 * 匿名の一般公開にする場合は、authorize と合わせて AuthGuard を外すことになる。
 */
const SurveyPublicLayout = () => (
  <AuthGuard>
    <CommonLayout demo={surveyDemo} />
  </AuthGuard>
);

export default SurveyPublicLayout;
