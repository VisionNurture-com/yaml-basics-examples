import sys

from settings import load_settings


def main():
    print(load_settings(sys.argv[1]))
