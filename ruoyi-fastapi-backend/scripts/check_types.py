import argparse
import subprocess
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
E2E = BACKEND.parent / 'ruoyi-fastapi-test'
CI = BACKEND.parent / '.github'
PROJECTS = (BACKEND, E2E, CI)


def project_targets(targets: list[Path]) -> dict[Path, list[Path]]:
    """
    将目标分配到各自的 Python 导入根目录，避免两个工程的同名模块互相遮蔽。

    :param targets: 用户指定的源码文件或目录
    :return: 按工程分组的绝对路径
    """
    groups: dict[Path, list[Path]] = {}
    for target in targets:
        path = target.resolve()
        owner = next((project for project in PROJECTS if path.is_relative_to(project)), None)
        if owner:
            groups.setdefault(owner, []).append(path)
        elif path == BACKEND.parent:
            for project in PROJECTS:
                groups.setdefault(project, []).append(project)
        else:
            groups.setdefault(BACKEND, []).append(path)
    return groups


def main() -> int:
    """
    通过当前解释器运行 ty 并汇总各工程的退出状态。

    :return: 所有工程通过时返回零，否则返回子进程的错误码
    """
    parser = argparse.ArgumentParser(description='按工程运行 ty 类型检查')
    parser.add_argument('--full', action='store_true', help='兼容旧命令，默认即报告全部诊断')
    parser.add_argument('--python-version', metavar='X.Y', help='覆盖 ty 配置中的目标 Python 版本')
    parser.add_argument('paths', type=Path, nargs='*', help='要检查的文件或目录，默认检查当前目录')
    args = parser.parse_args()
    status = 0
    command = [sys.executable, '-m', 'ty', 'check', '--python', sys.executable]
    if args.python_version:
        command.extend(['--python-version', args.python_version])
    for project, paths in project_targets(args.paths or [Path.cwd()]).items():
        print(f'ty check [{project.name}]', flush=True)
        result = subprocess.run([*command, '--', *paths], cwd=project, check=False)
        status = max(status, result.returncode if result.returncode >= 0 else 1)
    return status


if __name__ == '__main__':
    raise SystemExit(main())
