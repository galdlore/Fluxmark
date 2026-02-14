# 仕様書 - FluxMarks (Chrome Extension)

## 1. プロジェクト概要
**FluxMarks** は、Chromeのサイドパネルで動作するブックマーク管理拡張機能です。
標準のブックマーク機能とは独立した「仮想ツリー（Virtual Tree）」を持ち、ユーザーが自由に並び替えやリネームを行えるカスタマイズ性の高いインターフェースを提供します。

## 2. 技術スタック
- **Frontend Framework**: React 19
- **Build Tool**: Vite 7
- **Language**: TypeScript
- **Styling**: Standard CSS (Utility-based structure, similar to Tailwind)
- **Drag & Drop**: @dnd-kit/core, @dnd-kit/sortable
- **Browser API**: Chrome Extension Manifest V3 (Side Panel, Bookmarks, Storage)

## 3. 主な機能

### 3.1 サイドパネル表示
- ChromeのサイドパネルAPIを使用し、ブラウジングを妨げずにブックマーク常時表示が可能。
- キーボードショートカット（Alt+B）等で素早くアクセス。

### 3.2 仮想ブックマーク管理 (Virtual Tree)
- **カスタム並び替え**: Chrome標準のブックマーク順序とは独立して、拡張機能内で独自の順序をドラッグ＆ドロップで設定可能（フォルダ移動はChromeにも反映）。
- **カスタムリネーム**: 標準のブックマーク名を変更せずに、拡張機能内での表示名のみを変更可能。
- **同期機能**: Chrome標準のブックマークの「追加」「削除」「移動」イベントを検知し、仮想ツリーに反映。

### 3.3 コンテキストメニュー
ブックマーク項目を右クリックすることで、以下の独自アクションを実行可能：
- **Open in Background**: フォルダまたは単一ブックマークをバックグラウンドタブで開く。
- **Rename**: 表示名の変更。
- **Hide / Restore**: アイテムを一時的に非表示にする、または復元する（物理削除ではない）。
- **Flags**: 特定のステータス（OpenFlag）の設定（詳細仕様は実装に依存）。

### 3.4 ドラッグ＆ドロップ (DnD)
- `@dnd-kit` を使用したスムーズな並び替え操作。
- **Overlay**: ドラッグ中のアイテムを最前面レイヤーに表示し、スクロールやフォルダ階層による表示切れを防止。
- **Hover Expand**: 閉じたフォルダ上にドラッグして待機すると自動で展開。
- **Native Sync**: 操作結果を即座にChrome標準のブックマークに反映。

## 4. ディレクトリ構成
```text
src/
├── background/      # Service Worker (イベントハンドリング)
├── content/         # Content Scripts (必要に応じてページ操作)
├── popup/           # Popup UI (現状はManifestでAction指定なし)
├── sidepanel/       # Side Panel UI (React App Entry Point)
│   ├── components/  # BookmarkNode, ContextMenu 等のUIコンポーネント
│   ├── hooks/       # useBookmarks 等のカスタムフック
│   └── utils/       # virtualTreeUtils, bookmarkActions 等のロジック
└── public/          # 静的リソース
```

## 5. データモデル
### VirtualNode
Chromeのブックマークノードを参照しつつ、独自のメタデータを保持する構造体。
- `id`: Chrome Bookmark ID
- `title`: 表示用タイトル（カスタム可能）
- `children`: 子ノードのリスト（独自の順序を保持）

## 6. 今後の開発課題
- 仮想ツリーのさらなるパフォーマンス最適化（大量のブックマークへの対応）。
- テーマ機能の拡充。
