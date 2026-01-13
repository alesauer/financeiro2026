 import os
from alembic.config import Config
from alembic import command

if __name__ == '__main__':
    base_dir = os.path.dirname(os.path.dirname(__file__))
    ini_path = os.path.join(base_dir, 'migrations', 'alembic.ini')
    cfg = Config(ini_path)
    command.upgrade(cfg, 'head')
    print('Alembic upgrade head completed.')
