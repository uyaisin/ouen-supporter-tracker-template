# SETUP-AI.md — AIアシスタント（Claude Code等）向けセットアップ指示書

あなた（AIアシスタント）への指示書です。ユーザーの代わりに、このテンプレートから「サポータートラッカー」を構築してください。人間向けの詳細説明は [SETUP.md](SETUP.md) にあります（Apps Scriptのコピペ用コードもそちら）。

## ゴール
1. ユーザーのGitHubアカウントに、このテンプレートから新しいリポジトリを作る
2. GitHub Pagesで公開し、URLが200を返すことを確認する
3. 自動更新（GitHub Actions）が動くことを確認する
4. ユーザーのGoogleシートを繋いで本番データ化する（ここは人間の作業が一部必要）

## 前提チェック（最初にやる）
- `gh` CLI がインストール済みか（`gh --version`）。無ければ `brew install gh`（Mac）等で導入
- `gh auth status` でログイン済みか。未ログインなら `gh auth login` をユーザーに案内（ブラウザ認証は人間の作業）

## STEP 1. テンプレートからリポジトリ作成
```bash
gh repo create <好きな名前> --template uyaisin/ouen-supporter-tracker-template --public --clone
```
- **重要**: 必ず `--template` を使うこと。cloneしてpushし直す方式だと、`.github/workflows/` のpushに `workflow` スコープが必要になり失敗しやすい。`--template` ならサーバー側でコピーされるので不要。
- リポジトリ名はユーザーに確認（例: `supporter-tracker`）。

## STEP 2. GitHub Pages 有効化
```bash
gh api -X POST repos/<owner>/<repo>/pages -f "source[branch]=main" -f "source[path]=/"
```
その後、`https://<owner>.github.io/<repo>/` が200を返すまでポーリング（15秒間隔・最大5分程度）。

## STEP 3. 自動更新（Actions）の動作確認
```bash
gh workflow run update-tracker --repo <owner>/<repo>
gh run list --repo <owner>/<repo> --limit 1
```
- 成功を確認（`gh run watch <run-id> --exit-status`）。
- この時点では**サンプルデータ**で動く（正常）。ページにゲージ・推移グラフ・都道府県タイルが表示されていればOK。
- スケジュール実行（30分おき）は `.github/workflows/update.yml` に定義済み。追加作業不要。

## STEP 4. ユーザーのシートを繋ぐ（人間の作業を案内する）
以下はGoogle側の作業なので、AIはSETUP.mdのSTEP 4を開いて**手順とコードを提示し、ユーザーを誘導**する（ブラウザ操作ツールがあれば代行してもよい）:
1. ユーザーのスプレッドシート（「都道府県」列があるもの）の拡張機能→Apps Scriptに、SETUP.md記載の `doGet` コードを貼る（タブ名・列名・目標人数の3か所を調整）
2. ウェブアプリとしてデプロイ（実行=自分／アクセス=**全員**）→ `.../exec` のURLを受け取る

URLをもらったら、まず中身を検証:
```bash
curl -sL "<execのURL>" | head -c 300   # {"prefs":{...},"goal":...} が返ればOK
```
問題なければSecretに登録して再実行:
```bash
gh secret set DATA_ENDPOINT --repo <owner>/<repo> --body "<execのURL>"
gh workflow run update-tracker --repo <owner>/<repo>
```
実行成功後、公開ページの数字が本番（シートの集計値）になったことを確認。

## STEP 5. 完了報告
ユーザーに以下を伝える:
- 公開URL: `https://<owner>.github.io/<repo>/`
- 画像URL（外部サイトに `<img>` で貼る用）: `https://<owner>.github.io/<repo>/supporter-tracker.png`
- 30分おきに自動更新されること（PC起動不要・無料）
- 文言や目標人数の変え方は README / SETUP.md 参照

## カスタマイズを頼まれたら
- タイトル・文言: `template.html` の `.hero` 付近
- 目標人数: Apps Script側の `GOAL`（シート接続前は `data.json` の `goal`）
- 色分けしきい値: `template.html` の `tier()` 関数
- 編集後は push すれば Actions が自動で再ビルドする（`data.json` を手で変えた場合も同様）

## トラブルシューティング
- Pagesが404のまま → ビルドに数分かかる。`gh api repos/<owner>/<repo>/pages --jq .status` で状態確認
- Actionsが失敗 → `gh run view <id> --log-failed`。よくある原因はSecret未登録（未登録でもサンプルで成功するはず）・exec URLのアクセス権限が「全員」になっていない
- 数字がサンプルのまま → Secret登録後にworkflowを1回実行したか確認
- doGetの応答がHTML → Apps Scriptのデプロイが「ウェブアプリ」になっていない、または新バージョンでデプロイされていない
