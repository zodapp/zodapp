import CommonLayout from "../../components/CommonLayout";
import { AuthGuard } from "../../shared/auth";
import { surveyDemo } from "../../shared/demos";

/**
 * 回答者向けの画面用レイアウト。
 *
 * 回答ページは管理画面ではないので、アンケート一覧・回答一覧といった
 * 管理用のサイドバーを出さない（`navItems` を渡さないと CommonLayout は
 * サイドバーごと描画しない）。共通ヘッダーだけを引き継ぐ。
 *
 * 認証は残している。Firestore のルール上、回答の作成にはワークスペースの
 * メンバーであることが必要なため（firestore.rules の `/responses` 参照）。
 * 匿名の一般公開にする場合は、ルールと合わせて AuthGuard を外すことになる。
 */
const SurveyPublicLayout = () => (
  <AuthGuard>
    <CommonLayout demo={surveyDemo} />
  </AuthGuard>
);

export default SurveyPublicLayout;
