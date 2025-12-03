import sys
import traceback

def execute_user_code(file_path):
    try:
        with open(file_path, "r", encoding='utf-8') as f:  
            code = f.read()
        exec(code, {"__name__": "__main__"})
    except Exception as e:
        traceback.print_exc(file=sys.stderr)

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python sandbox.py <file_path>")
        sys.exit(1)

    file_path = sys.argv[1]
    execute_user_code(file_path)