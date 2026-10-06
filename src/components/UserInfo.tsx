interface User {
	username: string;
	email: string;
}

interface UserInfoProps {
	user: User;
}

export function UserInfo({ user }: UserInfoProps) {
	return (
		<div className="flex items-center">
			<div className="bg-blue-950 text-white flex aspect-square size-8 items-center justify-center rounded-full">
				<span className="text-sm font-medium">
					{user.username.charAt(0).toUpperCase()}
				</span>
			</div>
			<div className="ml-2 grid flex-1 text-left text-sm">
				<span className="truncate font-medium">{user.username}</span>
				<span className="truncate text-xs text-gray-500">{user.email}</span>
			</div>
		</div>
	);
}
