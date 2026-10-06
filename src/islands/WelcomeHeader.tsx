interface WelcomeHeaderProps {
	username: string;
}

export default function WelcomeHeader({ username }: WelcomeHeaderProps) {
	return (
		<h1 className="text-3xl font-bold text-blue-950 mb-6">
			¡Bienvenido, {username}!
		</h1>
	);
}
