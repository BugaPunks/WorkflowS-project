import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLogoIcon } from "@/components/AppLogoIcon";

interface RegisterFormData {
	name: string;
	email: string;
	password: string;
	confirmPassword: string;
}

const STAGES = ["Backlog", "Sprint", "Revisión", "Entrega"];

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
			<div className="min-h-screen bg-white font-sans flex items-center justify-center p-6">
				<div className="w-full max-w-sm text-center">
					<div className="bg-green-50 border border-green-200 text-green-700 px-6 py-8 rounded-2xl shadow-sm">
						<div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 mb-4">
							<svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
								<path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
							</svg>
						</div>
						<h2 className="text-2xl font-bold tracking-tight mb-2">¡Registro Exitoso!</h2>
						<p className="text-green-800 mb-4">Tu cuenta ha sido creada correctamente.</p>
						<p className="text-sm font-medium text-green-600 animate-pulse">Redirigiendo a login...</p>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-white font-sans flex">
			{/* Lado izq: marca */}
			<aside className="hidden lg:flex w-[46%] bg-linear-to-br from-blue-950 via-blue-950 to-blue-900 text-white flex-col justify-between p-12">
				<div className="flex items-center gap-3">
					<div className="bg-white/15 backdrop-blur flex size-10 items-center justify-center rounded-xl">
						<AppLogoIcon className="size-6 fill-current text-white" />
					</div>
					<span className="text-lg font-semibold tracking-tight">
						WorkflowS
					</span>
				</div>

				<div>
					<h1 className="text-4xl font-bold leading-tight tracking-tight">
						Únete a tu equipo
						<br />
						y empieza a crear.
					</h1>
					<p className="mt-4 max-w-xs text-base font-light text-blue-200">
						Agilidad real para proyectos reales. Regístrate y toma el control de tu flujo de trabajo.
					</p>

					{/* Pipeline */}
					<div
						className="mt-10 flex items-center gap-0"
						role="img"
						aria-label="Flujo de trabajo ágil: Backlog, Sprint, Revisión y Entrega"
					>
						{STAGES.map((stage, i) => (
							<div key={stage} className="flex items-center">
								<div
									className="workflowpulse group flex flex-col items-center gap-1.5 px-3"
									style={{ animationDelay: `${i * 0.7}s` }}
								>
									<div className="flex items-center gap-1.5">
										<i className="block size-2.5 rounded-full bg-white/90 shadow-[0_0_8px_rgba(255,255,255,0.7)]" />
										<i className="block size-2.5 rounded-full bg-white/90 shadow-[0_0_8px_rgba(255,255,255,0.7)]" />
									</div>
									<span className="text-[10px] font-medium tracking-wide text-blue-200">
										{stage}
									</span>
								</div>
								{i < STAGES.length - 1 && (
									<i
										className="block h-px w-8 bg-white/30"
										aria-hidden="true"
									/>
								)}
							</div>
						))}
					</div>
				</div>

				<p className="text-sm font-light text-blue-300">
					© {new Date().getFullYear()} WorkflowS
				</p>
			</aside>

			{/* Lado der: formulario */}
			<main className="flex flex-1 items-center justify-center p-6 overflow-y-auto">
				<div className="w-full max-w-sm py-8">
					<div className="mb-8 flex items-center justify-center gap-3 lg:hidden">
						<div className="bg-blue-950 text-white flex size-9 items-center justify-center rounded-lg">
							<AppLogoIcon className="size-5 fill-current" />
						</div>
						<span className="text-lg font-semibold tracking-tight text-slate-900">
							WorkflowS
						</span>
					</div>

					<h2 className="text-3xl font-bold tracking-tight text-slate-900">
						Crear cuenta
					</h2>
					<p className="mt-1.5 text-sm text-slate-500">
						Ingresa tus datos para registrarte en la plataforma.
					</p>

					<form onSubmit={handleSubmit} className="mt-8 space-y-4">
						{submitError && (
							<div
								className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 rounded-lg"
								role="alert"
							>
								{submitError}
							</div>
						)}

						<div>
							<label
								className="mb-1.5 block text-sm font-medium text-slate-700"
								htmlFor="name"
							>
								Nombre Completo
							</label>
							<input
								className={`w-full rounded-lg border bg-white px-3.5 py-2 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
									errors.name
										? "border-red-300 focus:ring-red-600"
										: "border-slate-300 focus:ring-blue-700"
								}`}
								id="name"
								name="name"
								type="text"
								placeholder="Juan Pérez"
								value={formData.name}
								onChange={handleChange}
							/>
							{errors.name && (
								<p className="mt-1 text-xs text-red-600">{errors.name}</p>
							)}
						</div>

						<div>
							<label
								className="mb-1.5 block text-sm font-medium text-slate-700"
								htmlFor="email"
							>
								Correo electrónico
							</label>
							<input
								className={`w-full rounded-lg border bg-white px-3.5 py-2 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
									errors.email
										? "border-red-300 focus:ring-red-600"
										: "border-slate-300 focus:ring-blue-700"
								}`}
								id="email"
								name="email"
								type="email"
								autoComplete="email"
								placeholder="tu@email.com"
								value={formData.email}
								onChange={handleChange}
							/>
							{errors.email && (
								<p className="mt-1 text-xs text-red-600">{errors.email}</p>
							)}
						</div>

						<div>
							<label
								className="mb-1.5 block text-sm font-medium text-slate-700"
								htmlFor="password"
							>
								Contraseña
							</label>
							<input
								className={`w-full rounded-lg border bg-white px-3.5 py-2 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
									errors.password
										? "border-red-300 focus:ring-red-600"
										: "border-slate-300 focus:ring-blue-700"
								}`}
								id="password"
								name="password"
								type="password"
								autoComplete="new-password"
								placeholder="••••••••"
								value={formData.password}
								onChange={handleChange}
							/>
							{errors.password && (
								<p className="mt-1 text-xs text-red-600">{errors.password}</p>
							)}
						</div>

						<div>
							<label
								className="mb-1.5 block text-sm font-medium text-slate-700"
								htmlFor="confirmPassword"
							>
								Confirmar Contraseña
							</label>
							<input
								className={`w-full rounded-lg border bg-white px-3.5 py-2 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
									errors.confirmPassword
										? "border-red-300 focus:ring-red-600"
										: "border-slate-300 focus:ring-blue-700"
								}`}
								id="confirmPassword"
								name="confirmPassword"
								type="password"
								autoComplete="new-password"
								placeholder="••••••••"
								value={formData.confirmPassword}
								onChange={handleChange}
							/>
							{errors.confirmPassword && (
								<p className="mt-1 text-xs text-red-600">
									{errors.confirmPassword}
								</p>
							)}
						</div>

						<button
							type="submit"
							disabled={isSubmitting}
							className={`mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-700 focus:ring-offset-2 ${
								isSubmitting ? "cursor-not-allowed opacity-60" : ""
							}`}
						>
							{isSubmitting ? "Registrando…" : "Registrarse"}
						</button>
					</form>

					<p className="mt-6 text-center text-sm text-slate-600">
						¿Ya tienes cuenta?{" "}
						<a
							href="/login"
							className="font-semibold text-blue-950 transition hover:text-blue-900"
						>
							Inicia sesión aquí
						</a>
					</p>
				</div>
			</main>
		</div>
	);
}
