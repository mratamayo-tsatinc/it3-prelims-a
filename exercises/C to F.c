#[[include]] <[[stdio.h]]>

int main() 
{
    float celsius, fahr;
    
    printf("Enter Celsius: ");
    scanf("%f", [[&]]celsius);
    
    fahr = (celsius * 9/5) + 32;
    printf("Fahrenheit: %.1f\n", fahr);
    
	[[return]] 0;
}