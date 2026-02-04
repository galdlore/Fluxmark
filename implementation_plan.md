# 実装計画: 機能追加（一括設定・削除）

## ユーザーの目的
1. **一括コントロール**: ブックマークを開く際のデフォルト挙動（現在のタブ、新規タブ、バックグラウンド）をグローバル設定として変更できるようにする。
2. **削除機能**: サイドバーからブックマークを削除できるようにする。

## 実装ステップ

### 1. ユーティリティの更新 (`src/sidepanel/utils/bookmarkActions.ts`)
- `GlobalDefault` 設定（'NF', 'RF', 'NB'）の保存・取得関数を追加。
- `openBookmark` 関数を改修し、個別フラグがない場合は `GlobalDefault` を参照するように変更。
- `deleteBookmark` 関数を追加（`chrome.bookmarks.remove` / `removeTree` を使用）。

### 2. コンポーネントの更新 (`src/sidepanel/components/ContextMenu.tsx`)
- `onDelete` プロパティを追加。
- メニュー内に「🗑️ Delete」ボタンを追加（`isSafetyMode` が false の場合のみ表示）。

### 3. メインUIの更新 (`src/sidepanel/App.tsx`)
- **Header UI**: グローバル設定を変更するためのセレクター（ドロップダウン等）を追加。
- **State管理**: グローバル設定の状態（`globalDefault`）を管理し、ロード時に初期化、変更時に保存。
- **削除ハンドラ**: `handleDelete` を実装し、`ContextMenu` に渡す。
  - 削除実行時、Chrome APIを呼び出す（`useBookmarks` のリスナー経由でリストは自動更新されるはずだが、念のため確認）。

### 4. 検証
- デフォルト設定を変更し、フラグ未設定のブックマークの開き方が変わることを確認。
- 右クリックメニューから削除を実行し、実際にブックマークが消えることを確認。
