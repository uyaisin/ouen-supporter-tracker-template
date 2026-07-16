# セットアップ手順（自分のトラッカーを作る）

このテンプレートから、**自分専用のサポータートラッカー**を無料で作れます。
Macを起動しておく必要はありません（更新はGitHubのクラウドで自動で回ります）。

かかる時間：だいたい15〜20分。GitHubアカウント（無料）があればOK。

---

## STEP 1. テンプレートから自分のリポジトリを作る

1. このリポジトリのページ右上の緑ボタン **「Use this template」→「Create a new repository」** を押す
2. リポジトリ名を決める（例：`my-supporter-tracker`）／**Public** を選ぶ
3. 「Create repository」

これで自分のアカウントに、中身がそっくりコピーされます。

## STEP 2. GitHub Pages を有効にして公開URLを作る

1. 作ったリポジトリの **Settings → Pages**
2. 「Build and deployment」の Source を **Deploy from a branch**、Branch を **main / (root)** にして Save
3. 1〜2分後、`https://（自分のユーザー名）.github.io/（リポジトリ名）/` で表示される

この時点では**サンプルの数字**で表示されます（見た目とグラフの確認用）。

## STEP 3. Actions（自動更新）を有効にする

1. 上部の **Actions** タブを開く
2. 「I understand my workflows, go ahead and enable them」を押す

これで30分おきに自動更新が回るようになります（手動実行も Actions タブからできます）。

## STEP 4. 自分のシートを繋ぐ（データ源）

サポーター数の元になるスプレッドシートを用意します。**「都道府県」列**さえあれば集計できます。

1. Google スプレッドシートに、報告フォームの回答（都道府県が入る列）を用意する
2. スプレッドシートの **拡張機能 → Apps Script** を開き、下のコードを貼る
   （`SHEET_NAME` と 都道府県の列名は自分のシートに合わせて変更）

```javascript
function doGet() {
  const SHEET_NAME = "フォームの回答 1";   // ← 自分のタブ名に
  const PREF_HEADER = "都道府県";           // ← 都道府県が入る列の見出し
  const GOAL = 1000;                        // ← 目標人数

  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const values = sh.getDataRange().getValues();
  const header = values.shift();
  const col = header.indexOf(PREF_HEADER);

  const PREFS = ["北海道","青森","岩手","宮城","秋田","山形","福島","茨城","栃木","群馬",
    "埼玉","千葉","東京","神奈川","新潟","富山","石川","福井","山梨","長野","岐阜","静岡",
    "愛知","三重","滋賀","京都","大阪","兵庫","奈良","和歌山","鳥取","島根","岡山","広島",
    "山口","徳島","香川","愛媛","高知","福岡","佐賀","長崎","熊本","大分","宮崎","鹿児島","沖縄"];

  const prefs = {};
  values.forEach(row => {
    const cell = String(row[col] || "");
    const hit = PREFS.find(p => cell.indexOf(p.replace(/(都|道|府|県)$/,"")) >= 0);
    if (hit) prefs[hit] = (prefs[hit] || 0) + 1;
  });

  return ContentService
    .createTextOutput(JSON.stringify({ prefs, goal: GOAL }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

3. **デプロイ → 新しいデプロイ → 種類「ウェブアプリ」**
   - 実行するユーザー：**自分**
   - アクセスできるユーザー：**全員**
   - デプロイして表示される **ウェブアプリのURL（.../exec）** をコピー

## STEP 5. シートURLをトラッカーに登録する

1. 自分のリポジトリの **Settings → Secrets and variables → Actions**
2. **New repository secret** を押す
3. Name に **`DATA_ENDPOINT`**、Value に STEP4でコピーしたURLを貼って Save

次の自動更新（または Actions タブ → update-tracker → Run workflow で手動実行）から、**本物のサポーター数**に切り替わります。

---

## 変えられるところ
- **目標人数**：Apps Scriptの `GOAL`（シート側）。シートを繋がない間は `data.json` の `goal`
- **タイトル・文言**：`template.html` の `.hero` 付近
- **色分けのしきい値**：`template.html` の `tier()` 関数（今は 1／2〜4／5〜9／10人以上）

## うまく動かないときの確認
- ページが404 → STEP2のPagesがまだビルド中（数分待つ）／Sourceがmain/rootか確認
- 数字がサンプルのまま → STEP3のActions有効化と、STEP5の `DATA_ENDPOINT` 登録を確認
- Actionsが赤（失敗）→ Actionsタブでログを見る。多くはシートURLの権限（アクセス「全員」になっているか）

困ったら、このテンプレートを渡してくれた人に、このSETUP.mdごと相談してください。
