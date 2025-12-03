import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        // Scanner for user input
        Scanner sc = new Scanner(System.in);

        System.out.print("Enter your name: ");
        String name = sc.nextLine();

        System.out.print("Enter two numbers: ");
        int a = sc.nextInt();
        int b = sc.nextInt();

        System.out.println("\n--- OUTPUT ---");
        System.out.println("Hello, " + name + "!");
        System.out.println("Sum: " + (a + b));
        System.out.println("Difference: " + (a - b));
        System.out.println("Product: " + (a * b));
        
        if (b != 0) {
            System.out.println("Division: " + (a / (double)b));
        } else {
            System.out.println("Division: Cannot divide by zero!");
        }

        System.out.println("\nLoop Test:");
        for (int i = 1; i <= 5; i++) {
            System.out.println("Count: " + i);
        }

        sc.close();
    }
}
