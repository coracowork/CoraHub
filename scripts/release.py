#!/usr/bin/env python3
"""
CoraHub Release Automation
Automatiza: commit, tag, push e release no GitHub.
O CI (build-extensions.yml) constroi as extensoes e empurra para a branch dist.

Uso:
    python scripts/release.py                    # menu interativo
    python scripts/release.py 1.0.0              # versao direta
    python scripts/release.py 1.0.0 --dry-run    # mostra o que faria sem fazer
"""

import subprocess
import sys
import os
import json
import re
import argparse
from pathlib import Path

try:
    import requests
except ImportError:
    print("Instalando requests...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "requests", "-q"])
    import requests


# ── Config ──────────────────────────────────────────────────────────────────
REPO_OWNER = "coracowork"
REPO_NAME = "CoraHub"
PROJECT_ROOT = Path(__file__).parent.parent
PACKAGE_JSON = PROJECT_ROOT / "package.json"


# ── Helpers ─────────────────────────────────────────────────────────────────
def run(cmd: str, check=True, capture=False, cwd=None) -> subprocess.CompletedProcess:
    """Executa comando no shell."""
    result = subprocess.run(
        cmd, shell=True, capture_output=capture, text=True, encoding="utf-8",
        cwd=cwd or str(PROJECT_ROOT),
    )
    if check and result.returncode != 0:
        stderr = result.stderr.strip() if capture else ""
        print(f"  ERRO: {cmd}")
        if stderr:
            print(f"  {stderr[:500]}")
        sys.exit(1)
    return result


def get_current_version() -> str:
    """Le a versao atual do package.json (ou retorna 0.0.0 se nao existe)."""
    if not PACKAGE_JSON.exists():
        return "0.0.0"
    data = json.loads(PACKAGE_JSON.read_text(encoding="utf-8"))
    return data.get("version", "0.0.0")


def set_version(version: str):
    """Atualiza versao no package.json."""
    if not PACKAGE_JSON.exists():
        print("  package.json nao encontrado")
        return

    data = json.loads(PACKAGE_JSON.read_text(encoding="utf-8"))
    old_version = data.get("version", "0.0.0")
    data["version"] = version
    PACKAGE_JSON.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    print(f"  package.json: {old_version} -> {version}")


def get_extension_versions() -> dict[str, str]:
    """Le versoes de todas as extensoes."""
    versions = {}
    extensions_dir = PROJECT_ROOT / "extensions"
    if not extensions_dir.exists():
        return versions

    for ext_dir in sorted(extensions_dir.iterdir()):
        if not ext_dir.is_dir() or not ext_dir.name.startswith("coraext-"):
            continue
        json_path = ext_dir / "cora-extension.json"
        if json_path.exists():
            data = json.loads(json_path.read_text(encoding="utf-8"))
            versions[ext_dir.name] = data.get("version", "1.0.0")
    return versions


def validate_version(v: str) -> bool:
    """Valida formato semver."""
    return bool(re.match(r'^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$', v))


def get_github_token() -> str:
    """Pega token do ambiente ou pede ao usuario."""
    for var in ("GITHUB_TOKEN", "GH_TOKEN"):
        token = os.environ.get(var, "").strip()
        if token:
            return token

    result = run("gh auth token", check=False, capture=True)
    if result.returncode == 0 and result.stdout.strip():
        return result.stdout.strip()

    print("\n  Token do GitHub necessario.")
    print("  Opcoes:")
    print("    1. Exporte: export GITHUB_TOKEN=ghp_xxx")
    print("    2. Instale gh: https://cli.github.com/")
    print("    3. Cole o token abaixo:")
    token = input("  GITHUB_TOKEN> ").strip()
    if not token:
        print("  Saindo.")
        sys.exit(1)
    return token


def git_has_changes() -> bool:
    result = run("git status --porcelain", check=False, capture=True)
    return bool(result.stdout.strip())


def get_changed_files() -> list[str]:
    result = run("git status --porcelain", check=False, capture=True)
    files = []
    for line in result.stdout.strip().splitlines():
        if line.strip():
            status = line[:2].strip()
            filename = line[3:].strip()
            files.append(f"  [{status}] {filename}")
    return files


def tag_exists(tag: str) -> bool:
    result = run(f"git tag -l {tag}", check=False, capture=True)
    if result.stdout.strip():
        return True
    result = run(f"git ls-remote --tags origin {tag}", check=False, capture=True)
    return tag in result.stdout


def inc_version(version: str, bump: str) -> str:
    parts = version.split("-")[0].split(".")
    major, minor, patch = int(parts[0]), int(parts[1]), int(parts[2])
    if bump == "major":
        return f"{major + 1}.0.0"
    elif bump == "minor":
        return f"{major}.{minor + 1}.0"
    else:
        return f"{major}.{minor}.{patch + 1}"


# ── GitHub API ──────────────────────────────────────────────────────────────
def github_api(method: str, endpoint: str, token: str, **kwargs) -> dict | None:
    url = f"https://api.github.com{endpoint}"
    headers = {
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github.v3+json",
    }
    resp = requests.request(method, url, headers=headers, timeout=30, **kwargs)
    if resp.status_code in (200, 201):
        return resp.json()
    if resp.status_code == 422:
        return None
    print(f"  GitHub API {resp.status_code}: {resp.text[:300]}")
    return None


def create_github_release(tag: str, token: str, prerelease=False) -> str | None:
    print(f"\n  Criando release {tag}...")

    # Listar extensoes para o corpo do release
    extensions = get_extension_versions()
    ext_list = "\n".join(f"| `{name}` | {ver} |" for name, ver in extensions.items())

    body = f"""## CoraHub {tag}

Build automatico via CI/CD.

### Extensoes

| Extensao | Versao |
|----------|--------|
{ext_list}

### Distribuicao
As extensoes sao buildadas automaticamente e disponibilizadas na branch `dist`.

### Instalacao
Acesse a branch `dist` para baixar os `.zip` das extensoes ou use o `index.json` como catalogo.
"""

    payload = {
        "tag_name": tag,
        "name": f"Release {tag}",
        "body": body,
        "draft": False,
        "prerelease": prerelease,
    }

    data = github_api(
        "POST", f"/repos/{REPO_OWNER}/{REPO_NAME}/releases", token, json=payload
    )
    if not data:
        print("  Release pode ja existir. Verificando...")
        data = github_api(
            "GET", f"/repos/{REPO_OWNER}/{REPO_NAME}/releases/tags/{tag}", token
        )
        if data:
            return data.get("html_url")
        return None

    release_url = data.get("html_url", "")
    print(f"  Release criada: {release_url}")
    return release_url


# ── Fluxo principal ────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(
        description="CoraHub Release Automation",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Exemplos:
  python scripts/release.py                  # menu interativo
  python scripts/release.py 1.0.0            # versao especifica
  python scripts/release.py 1.0.0 --dry-run  # simular sem alterar
        """,
    )
    parser.add_argument("version", nargs="?", help="Versao (ex: 1.0.0)")
    parser.add_argument("--beta", action="store_true", help="Marcar como prerelease")
    parser.add_argument("--dry-run", action="store_true", help="Simular sem alterar")
    parser.add_argument("--skip-checks", action="store_true", help="Pular lint/check antes de commit")
    parser.add_argument("--no-tag", action="store_true", help="Nao criar tag")
    parser.add_argument("--no-release", action="store_true", help="Nao criar release (so push + tag)")
    parser.add_argument("--force-tag", action="store_true", help="Deletar tag existente e recriar")
    args = parser.parse_args()

    print("=" * 60)
    print("  CoraHub Release Automation")
    print("=" * 60)

    # ── Definir versao ──────────────────────────────────────────────────
    current = get_current_version()
    extensions = get_extension_versions()

    print(f"\n  Versao atual: {current}")
    print(f"  Extensoes ({len(extensions)}):")
    for name, ver in extensions.items():
        print(f"    - {name}: {ver}")

    if args.version:
        new_version = args.version
    else:
        print("\n  Opcoes:")
        print(f"    1) Major:  incrementar para {inc_version(current, 'major')}")
        print(f"    2) Minor:  incrementar para {inc_version(current, 'minor')}")
        print(f"    3) Patch:  incrementar para {inc_version(current, 'patch')}")
        print(f"    4) Manual: digitar versao")
        choice = input("\n  Escolha [1-4]: ").strip()

        bumps = {"1": "major", "2": "minor", "3": "patch"}
        if choice in bumps:
            new_version = inc_version(current, bumps[choice])
        elif choice == "4":
            new_version = input("  Versao: ").strip()
        else:
            print("  Opcao invalida.")
            return

    if not validate_version(new_version):
        print(f"  Versao invalida: {new_version}")
        return

    tag = f"v{new_version}"
    print(f"\n  Nova versao: {new_version}")
    print(f"  Tag:         {tag}")
    print(f"  Prerelease:  {'Sim' if args.beta else 'Nao'}")

    # ── Verificar estado do repo ────────────────────────────────────────
    print("\n─── Status do Repositorio ───")
    branch = run("git branch --show-current", capture=True).stdout.strip()
    remote = run("git remote get-url origin", capture=True).stdout.strip()
    print(f"  Branch:  {branch}")
    print(f"  Remote:  {remote}")

    has_changes = git_has_changes()
    if has_changes:
        print(f"\n  Mudancas nao commitadas:")
        for f in get_changed_files():
            print(f"    {f}")
    else:
        print("  Working tree limpo.")

    # ── Arquivos que serao atualizados ──────────────────────────────────
    print("\n─── Arquivos de Versao ───")
    print(f"  package.json:  {current} -> {new_version}")

    # ── Resumo e confirmacao ────────────────────────────────────────────
    print("\n─── Plano de Execucao ───")
    steps = []
    if has_changes:
        steps.append("1. git add . && git commit (mudancas pendentes)")
    n = len(steps) + 1
    steps.append(f"{n}. Atualizar versao em package.json")
    n += 1
    steps.append(f"{n}. git add . && git commit (chore(release): v{new_version})")
    if not args.no_tag:
        if tag_exists(tag) and not args.force_tag:
            steps.append(f"  ! Tag {tag} ja existe! Use --force-tag para recriar.")
        elif tag_exists(tag) and args.force_tag:
            n += 1
            steps.append(f"{n}. Deletar tag {tag} existente")
        n += 1
        steps.append(f"{n}. git tag -a {tag} -m 'Release {tag}'")
    n += 1
    steps.append(f"{n}. git push origin {branch}")
    if not args.no_tag:
        n += 1
        steps.append(f"{n}. git push origin {tag}")
    if not args.no_release:
        n += 1
        steps.append(f"{n}. Criar GitHub Release {tag}")
    n += 1
    steps.append(f"{n}. CI builda extensoes e empurra para branch dist")

    for s in steps:
        print(f"  {s}")

    if args.dry_run:
        print("\n  [DRY RUN] Nenhuma alteracao feita.")
        return

    confirm = input("\n  Confirmar? [s/N]: ").strip().lower()
    if confirm not in ("s", "sim", "y", "yes"):
        print("  Cancelado.")
        return

    # ── Executar ────────────────────────────────────────────────────────
    step_num = 0

    def log_step(msg):
        nonlocal step_num
        step_num += 1
        print(f"\n  [{step_num}] {msg}")

    # 1. Commit mudancas pendentes
    if has_changes:
        log_step("Commitando mudancas pendentes...")
        run("git add .")
        run('git commit -m "chore: pre-release updates"')

    # 2. Atualizar versao
    log_step(f"Atualizando versao para {new_version}...")
    set_version(new_version)

    # 3. Commit versao
    log_step("Commitando versao...")
    run("git add .")
    run(f'git commit -m "chore(release): v{new_version}" --allow-empty')

    # 4. Tag
    if not args.no_tag:
        if tag_exists(tag) and args.force_tag:
            log_step(f"Deletando tag {tag} existente...")
            run(f"git tag -d {tag}", check=False)
            run(f"git push origin :refs/tags/{tag}", check=False)

        log_step(f"Criando tag {tag}...")
        run(f'git tag -a {tag} -m "Release {tag}"')

    # 5. Push
    log_step(f"Push para origin/{branch}...")
    run(f"git push origin {branch}")
    if not args.no_tag:
        run(f"git push origin {tag}")

    # 6. Release
    release_url = None
    if not args.no_release:
        log_step("Criando GitHub Release...")
        token = get_github_token()
        release_url = create_github_release(tag, token, prerelease=args.beta)

    # ── Resultado ───────────────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("  RELEASE CONCLUIDA!")
    print("=" * 60)
    print(f"\n  Versao:  {new_version}")
    print(f"  Tag:     {tag}")
    if release_url:
        print(f"  Release: {release_url}")
    print(f"\n  Extensoes ({len(extensions)}):")
    for name, ver in extensions.items():
        print(f"    - {name}: {ver}")
    print(f"\n  CI estara buildando as extensoes e empurrando para branch dist.")
    print(f"\n  Acompanhe: https://github.com/{REPO_OWNER}/{REPO_NAME}/actions")
    print()


if __name__ == "__main__":
    main()
