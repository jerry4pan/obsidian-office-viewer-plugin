import sys

from msoffcrypto.format.ooxml import OOXMLFile


def main() -> None:
    if len(sys.argv) != 4:
        raise SystemExit("usage: encrypt-ooxml-fixture.py INPUT OUTPUT PASSWORD")

    input_path, output_path, password = sys.argv[1:]
    with open(input_path, "rb") as plain, open(output_path, "wb") as encrypted:
        OOXMLFile(plain).encrypt(password, encrypted)


if __name__ == "__main__":
    main()
