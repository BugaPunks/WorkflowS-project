import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSession } from "@/hooks/useSession";

interface LoginFormData {
	email: string;
	password: string;
}

export function LoginForm() {
	const navigate = useNavigate();
	const { login } = useSession();
	const [formData, setFormData] = useState<LoginFormData>({
		email: "",
		password: "",
	});
	const [errors, setErrors] = useState<
		Partial<Record<keyof LoginFormData, string>>
	>({});
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [submitError, setSubmitError] = useState<string | null>(null);

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const { name, value } = e.currentTarget;
		setFormData((prev) => ({
			...prev,
			[name]: value,
		}));

		// Limpiar errores cuando el usuario edita
		if (errors[name as keyof LoginFormData]) {
			setErrors((prev) => ({
				...prev,
				[name]: undefined,
			}));
		}
	};

	const validate = (): boolean => {
		const newErrors: Partial<Record<keyof LoginFormData, string>> = {};

		if (!formData.email) {
			newErrors.email = "El email es requerido";
		} else if (!/\S+@\S+\.\S+/.test(formData.email)) {
			newErrors.email = "El email no es válido";
		}

		if (!formData.password) {
			newErrors.password = "La contraseña es requerida";
		}

		setErrors(newErrors);
		return Object.keys(newErrors).length === 0;
	};

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setSubmitError(null);

		if (!validate()) {
			return;
		}

		setIsSubmitting(true);

		try {
			// Using /api prefix to use proxy
			const response = await fetch("/api/auth/login", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(formData),
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || "Error al iniciar sesión");
			}

			// Update session state
			login(
				{
					id: data.user.id,
					name: data.user.name,
					email: data.user.email,
					role: data.user.role,
					password: "", // Not needed in session
				},
				data.token,
			);

			// Redirigir directamente al dashboard (Proyectos)
			navigate("/");
		} catch (error) {
			setSubmitError(
				error instanceof Error ? error.message : "Error desconocido",
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div className="max-w-md mx-auto bg-white shadow-md rounded-lg p-6">
			<h2 className="text-2xl font-bold mb-6 text-center text-gray-800">
				Iniciar Sesión
			</h2>

			<form onSubmit={handleSubmit} className="space-y-4">
				{submitError && (
					<div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
						<p>{submitError}</p>
					</div>
				)}

				<div>
					<label
						className="block text-gray-700 text-sm font-bold mb-2"
						htmlFor="email"
					>
						Correo Electrónico
					</label>
					<input
						className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black ${
							errors.email ? "border-red-500" : "border-gray-300"
						}`}
						id="email"
						name="email"
						type="email"
						placeholder="tu@email.com"
						value={formData.email}
						onChange={handleChange}
					/>
					{errors.email && (
						<p className="text-red-500 text-xs mt-1">{errors.email}</p>
					)}
				</div>

				<div>
					<label
						className="block text-gray-700 text-sm font-bold mb-2"
						htmlFor="password"
					>
						Contraseña
					</label>
					<input
						className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-950 ${
							errors.password ? "border-red-500" : "border-gray-300"
						}`}
						id="password"
						name="password"
						type="password"
						placeholder="••••••••"
						value={formData.password}
						onChange={handleChange}
					/>
					{errors.password && (
						<p className="text-red-500 text-xs mt-1">{errors.password}</p>
					)}
				</div>

				<button
					type="submit"
					disabled={isSubmitting}
					className={`w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition ${
						isSubmitting ? "opacity-50 cursor-not-allowed" : ""
					}`}
				>
					{isSubmitting ? "Iniciando sesión..." : "Iniciar Sesión"}
				</button>
			</form>

			<p className="text-center text-gray-600 text-sm mt-4">
				¿No tienes cuenta?{" "}
				<a
					href="/register"
					className="text-blue-600 hover:text-blue-700 font-semibold"
				>
					Regístrate aquí
				</a>
			</p>
		</div>
	);
}
