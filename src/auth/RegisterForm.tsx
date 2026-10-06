import { useState } from "react";
import { useNavigate } from "react-router-dom";

interface RegisterFormData {
	name: string;
	email: string;
	password: string;
	confirmPassword: string;
}

export function RegisterForm() {
	const navigate = useNavigate();
	const [formData, setFormData] = useState<RegisterFormData>({
		name: "",
		email: "",
		password: "",
		confirmPassword: "",
	});
	const [errors, setErrors] = useState<
		Partial<Record<keyof RegisterFormData, string>>
	>({});
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [submitError, setSubmitError] = useState<string | null>(null);
	const [submitSuccess, setSubmitSuccess] = useState(false);

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const { name, value } = e.currentTarget;
		setFormData((prev) => ({
			...prev,
			[name]: value,
		}));

		if (errors[name as keyof RegisterFormData]) {
			setErrors((prev) => ({
				...prev,
				[name]: undefined,
			}));
		}
	};

	const validate = (): boolean => {
		const newErrors: Partial<Record<keyof RegisterFormData, string>> = {};

		if (!formData.name) {
			newErrors.name = "El nombre es requerido";
		} else if (formData.name.length < 3) {
			newErrors.name = "El nombre debe tener al menos 3 caracteres";
		}

		if (!formData.email) {
			newErrors.email = "El email es requerido";
		} else if (!/\S+@\S+\.\S+/.test(formData.email)) {
			newErrors.email = "El email no es válido";
		}

		if (!formData.password) {
			newErrors.password = "La contraseña es requerida";
		} else if (formData.password.length < 6) {
			newErrors.password = "La contraseña debe tener al menos 6 caracteres";
		}

		if (formData.password !== formData.confirmPassword) {
			newErrors.confirmPassword = "Las contraseñas no coinciden";
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
			// Using /api prefix which is proxied by rsbuild to backend
			const response = await fetch("/api/auth/register", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					name: formData.name,
					email: formData.email,
					password: formData.password,
				}),
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || "Error al registrar");
			}

			setSubmitSuccess(true);

			// Redirigir a login después de 2 segundos
			setTimeout(() => {
				navigate("/login");
			}, 2000);
		} catch (error) {
			setSubmitError(
				error instanceof Error ? error.message : "Error desconocido",
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	if (submitSuccess) {
		return (
			<div className="max-w-md mx-auto bg-white shadow-md rounded-lg p-6">
				<div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded text-center">
					<h2 className="text-xl font-bold mb-2">¡Registro Exitoso!</h2>
					<p>Tu cuenta ha sido creada correctamente.</p>
					<p className="text-sm mt-2">Redirigiendo a login...</p>
				</div>
			</div>
		);
	}

	return (
		<div className="max-w-md mx-auto bg-white shadow-md rounded-lg p-6">
			<h2 className="text-2xl font-bold mb-6 text-center text-gray-800">
				Registrarse
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
						htmlFor="name"
					>
						Nombre Completo
					</label>
					<input
						className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700 text-black ${
							errors.name ? "border-red-600" : "border-gray-300"
						}`}
						id="name"
						name="name"
						type="text"
						placeholder="Juan Pérez"
						value={formData.name}
						onChange={handleChange}
					/>
					{errors.name && (
						<p className="text-red-600 text-xs mt-1">{errors.name}</p>
					)}
				</div>

				<div>
					<label
						className="block text-gray-700 text-sm font-bold mb-2"
						htmlFor="email"
					>
						Correo Electrónico
					</label>
					<input
						className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700 text-black ${
							errors.email ? "border-red-600" : "border-gray-300"
						}`}
						id="email"
						name="email"
						type="email"
						placeholder="tu@email.com"
						value={formData.email}
						onChange={handleChange}
					/>
					{errors.email && (
						<p className="text-red-600 text-xs mt-1">{errors.email}</p>
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
						className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700 text-black ${
							errors.password ? "border-red-600" : "border-gray-300"
						}`}
						id="password"
						name="password"
						type="password"
						placeholder="••••••••"
						value={formData.password}
						onChange={handleChange}
					/>
					{errors.password && (
						<p className="text-red-600 text-xs mt-1">{errors.password}</p>
					)}
				</div>

				<div>
					<label
						className="block text-gray-700 text-sm font-bold mb-2"
						htmlFor="confirmPassword"
					>
						Confirmar Contraseña
					</label>
					<input
						className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700 text-black ${
							errors.confirmPassword ? "border-red-600" : "border-gray-300"
						}`}
						id="confirmPassword"
						name="confirmPassword"
						type="password"
						placeholder="••••••••"
						value={formData.confirmPassword}
						onChange={handleChange}
					/>
					{errors.confirmPassword && (
						<p className="text-red-600 text-xs mt-1">
							{errors.confirmPassword}
						</p>
					)}
				</div>

				<button
					type="submit"
					disabled={isSubmitting}
					className={`w-full bg-blue-950 hover:bg-blue-900 text-white font-bold py-2 px-4 rounded-lg transition ${
						isSubmitting ? "opacity-50 cursor-not-allowed" : ""
					}`}
				>
					{isSubmitting ? "Registrando..." : "Registrarse"}
				</button>
			</form>

			<p className="text-center text-gray-600 text-sm mt-4">
				¿Ya tienes cuenta?{" "}
				<a
					href="/login"
					className="text-blue-950 hover:text-blue-900 font-semibold"
				>
					Inicia sesión aquí
				</a>
			</p>
		</div>
	);
}
