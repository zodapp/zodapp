import { Link } from "@tanstack/react-router";

import styles from "../../../styles/page.module.css";
import { formListRoute } from "../../form/list.route";
import { taskManagerRoute } from "../../taskManager-top/index.route";
import { Box } from "@mantine/core";

const HomePage = () => {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <h1 style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>
          <Box
            w={240 - 76} // 左右10pxずつ削るので -20
            h={120 - 40} // 上下10pxずつ削るので -20
            style={{ overflow: "hidden" }}
          >
            <img
              src="/zodapp-logo.svg"
              alt="zodapp logomark"
              width={240}
              height={120}
              style={{ marginTop: -20, marginLeft: -38 }}
            />
          </Box>
        </h1>
        <p style={{ fontSize: "1.2rem", color: "#666", marginBottom: "2rem" }}>
          AIネイティブなスキーマ駆動開発フレームワーク
        </p>

        <div style={{ maxWidth: "600px", textAlign: "left" }}>
          <h2 style={{ fontSize: "1.3rem", marginBottom: "1rem" }}>特徴</h2>
          <ul style={{ lineHeight: "1.8", marginBottom: "2rem" }}>
            <li>
              <strong>スキーマファースト開発</strong>
              <br />
              一つのスキーマから型定義・フォームUI・Firebase連携を自動生成。
            </li>
            <li style={{ marginTop: "1rem" }}>
              <strong>メタデータ拡張システム</strong>
              <br />
              Zodスキーマをベースに、ラベル、表示オプションなどのUI情報をスキーマに付与することで、Zodのエコシステムを最大限に活かします。
            </li>
            <li style={{ marginTop: "1rem" }}>
              <strong>AIネイティブ設計</strong>
              <br />
              複数のスキーマの関係性を確認することを不要にし、
              AI開発の効率を最大限に高めるとともに、AIコーディングの結果を人間がレビューするのを格段に容易にします。
              AIコーディング時代の開発フレームワークです。
            </li>
          </ul>
        </div>

        <div className={styles.ctas}>
          <Link to={formListRoute.to} className={styles.secondary}>
            フォームデモ
          </Link>
          <Link to={taskManagerRoute.to} className={styles.secondary}>
            アプリデモ
          </Link>
        </div>
      </main>
      <footer className={styles.footer}>
        <p style={{ color: "#888" }}>
          TypeScript + Zod 4 + React 19 + TanStack + Firebase
        </p>
      </footer>
    </div>
  );
};

export default HomePage;
