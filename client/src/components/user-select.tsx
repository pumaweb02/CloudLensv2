import { useQuery } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { useUser } from "@/hooks/use-user";
import { Control } from "react-hook-form";

interface User {
  id: number;
  username: string;
  role: string;
}

interface UserSelectProps {
  control: Control<any>;
  name: string;
  label?: string;
}

export function UserSelect({ control, name, label = "User" }: UserSelectProps) {
  const { user: currentUser } = useUser();
  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: currentUser?.role === "admin"
  });

  // If not admin or no users available, return null
  if (currentUser?.role !== "admin") {
    return null;
  }

  // Default to admin user if no other users are available
  const availableUsers = users.length > 0 ? users : [currentUser];

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <Select 
            onValueChange={field.onChange} 
            defaultValue={field.value?.toString()}
          >
            <FormControl>
              <SelectTrigger>
                <SelectValue placeholder="Select user" />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {availableUsers.map((user) => (
                <SelectItem key={user.id} value={user.id.toString()}>
                  {user.username}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormItem>
      )}
    />
  );
}