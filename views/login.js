async function login() {
  const user = document.getElementById("user").value;
  const pass = document.getElementById("pass").value;

  const res = await fetch("/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user, pass })
  });

  const data = await res.json();

  if (res.ok) {
    alert("Login correcto");
  } else {
    alert("Error: " + data.msg);
  }
}
