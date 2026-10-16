#include <[[stdio.h]]>

int [[main]]() [[{]]
    char name[50];
	
    printf("Enter your name: ");
    scanf("%s", name);
    
	printf("Welcome, %s!\n", [[name]]);
    
	return 0;
}