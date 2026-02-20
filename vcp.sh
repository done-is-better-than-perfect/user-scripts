#!/usr/bin/env bash
# vcp: v=開発バージョン付与, c=commit, p=push・タグpush・mainマージ
# jsDelivr はタグを参照するため、p でタグ vX.Y.Z-dev.N を作成して push する。
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

do_v() {
  # script.js の US_VERSION の -dev.N をインクリメント
  if perl -i -pe "s/(var US_VERSION = '.*?-dev\.)(\d+)/\$1 . (\$2+1)/e" script.js 2>/dev/null; then
    NEW_VER=$(grep "var US_VERSION = " script.js | sed "s/.*'\(.*\)'.*/\1/")
    echo "v: US_VERSION → $NEW_VER"
    echo "開発バージョン: v${NEW_VER}"
  else
    echo "v: 開発バージョンの更新に失敗しました（perl で script.js を更新）"
    exit 1
  fi
}

do_c() {
  local msg="${1:-}"
  if [ -z "$msg" ]; then
    msg="v$(grep "var US_VERSION = " script.js | sed "s/.*'\(.*\)'.*/\1/")"
  fi
  git add -A
  if git diff --cached --quiet; then
    echo "c: コミットする変更がありません"
    return 0
  fi
  git commit -m "$msg"
  echo "c: committed → $msg"
}

do_p() {
  BRANCH=$(git branch --show-current)
  if [ -z "$BRANCH" ]; then
    echo "p: ブランチ名を取得できません"
    exit 1
  fi
  VER=$(grep "var US_VERSION = " script.js | sed "s/.*'\(.*\)'.*/\1/")
  TAG="v${VER}"
  echo "p: push $BRANCH → origin"
  git push origin "$BRANCH"
  if ! git rev-parse "$TAG" >/dev/null 2>&1; then
    echo "p: タグ $TAG を作成して push"
    git tag "$TAG"
    git push origin "$TAG"
  else
    echo "p: タグ $TAG は既に存在するためスキップ"
  fi
  if [ "$BRANCH" = "main" ]; then
    echo "p: すでに main のためマージはスキップ"
    return 0
  fi
  echo "p: main にマージして push"
  git checkout main
  git pull origin main
  git merge "$BRANCH" --no-edit
  git push origin main
  git checkout "$BRANCH"
  echo "p: 完了（main にマージ済み・タグ ${TAG} 済み）"
}

case "${1:-all}" in
  v) do_v ;;
  c) do_c "$2" ;;
  p) do_p ;;
  all)
    do_v
    RUN_VER=$(grep "var US_VERSION = " script.js | sed "s/.*'\(.*\)'.*/\1/")
    do_c
    do_p
    echo "---"
    echo "開発バージョン: v${RUN_VER}"
    ;;
  *)
    echo "usage: $0 [v|c|p|all]"
    echo "  v   開発バージョン付与（script.js の -dev.N をインクリメント）"
    echo "  c   commit（メッセージ省略時は vX.Y.Z-dev.N）"
    echo "  p   push → タグ vX.Y.Z-dev.N 作成＆push → main にマージ＆push"
    echo "  all v → c → p の順で実行（省略時は all）"
    exit 1
    ;;
esac
