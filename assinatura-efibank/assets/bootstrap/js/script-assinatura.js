$(document).ready(function () {
    $('#btn_emitir_assinatura').click(function (event) {
        if ($('#form-info')[0].checkValidity()) {
            var form_cartao_validation = ($('#form-cartao')[0].checkValidity() && $('#cartao')[0].classList.contains('active')) ? true : false;
            var form_boleto_validation = ($('#form-boleto')[0].checkValidity() && $('#boleto')[0].classList.contains('active')) ? true : false;

            if ((form_cartao_validation || form_boleto_validation)) {
                var plano = {};
                plano.descricao = document.getElementById('assinatura-descricao').value;
                plano.interval = document.getElementById('assinatura-interval').value;

                var item = {};
                item.name = document.getElementById('item-name').value;
                item.value = document.getElementById('item-value').value;
                item.amount = document.getElementById('item-amount').value;

                if (form_cartao_validation) {
                    $("#myModal").modal('show');
                    gerarToken(function () {
                        var customer = {};
                        customer.name = document.getElementById('customer-name').value;
                        customer.cpf = document.getElementById('customer-cpf').value;
                        customer.email = document.getElementById('customer-email').value;
                        customer.phone_number = document.getElementById('customer-phone_number').value;
                        customer.birth = document.getElementById('customer-birth').value;

                        var billing_address = {};
                        billing_address.street = document.getElementById('street').value;
                        billing_address.number = document.getElementById('number').value;
                        billing_address.neighborhood = document.getElementById('neighborhood').value;
                        billing_address.zipcode = document.getElementById('zipcode').value;
                        billing_address.city = document.getElementById('city').value;
                        billing_address.state = document.getElementById('state').value;

                        var payment_token = document.getElementById('token').value;

                        $.ajax({
                            url: 'emitir_assinatura.php',
                            type: 'post',
                            dataType: 'json',
                            data: {
                                plano: plano,
                                item: item,
                                customer: customer,
                                payment_token: payment_token,
                                billing_address: billing_address
                            },
                            success: function (success) {
                                $("#myModal").modal('hide');
                                if (success.code == 200) {
                                    $('#myModalResultCard').modal('show');
                                    var result = success.data;
                                    var $htmlGeral = "<th>" + result.subscription_id + "</th><th>" + result.status + "</th>";
                                    var $htmlInfo = "<th>" + result.plan.id + "</th><th>" + result.plan.interval + "</th><th>" + result.total + "</th>";

                                    document.getElementById('table-geral-card').innerHTML = $htmlGeral;
                                    document.getElementById('table-info-card').innerHTML = $htmlInfo;
                                }  else if (resposta.code == undefined) {
                                    alert("O Identificador de conta informado não corresponde à sua conta Efí")
                                }
                                else {
                                    $("#myModal").modal('hide');
                                    alert("Code: " + success.code + '\n' + 'Property: ' + success.error_description.property + '\n' + 'Message: ' + success.error_description.message)
                                }
                            },
                            error: function (error) {
                                $("#myModal").modal('hide');
                                var msg = JSON.stringify(error);
                                alert("Ocorreu um erro - Mensagem: \n" + msg);
                            }
                        });
                    });


                } else {
                    $("#myModal").modal('show');
                    var customer = {};
                    customer.name = document.getElementById('customer-name-b').value;
                    customer.cpf = document.getElementById('customer-cpf-b').value;
                    customer.phone_number = document.getElementById('customer-phoneNumber-b').value;


                    var expire_at = document.getElementById('expire_at').value;

                    $.ajax({
                        url: 'emitir_assinatura.php',
                        type: 'post',
                        dataType: 'json',
                        data: {
                            plano: plano,
                            item: item,
                            customer: customer,
                            expire_at: expire_at
                        },
                        success: function (success) {
                            $("#myModal").modal('hide');
                            if (success.code == 200) {
                                $('#myModalResult').modal('show');
                                var result = success.data;
                                var $htmlGeral = "<th>" + result.subscription_id + "</th><th>" + result.status + "</th><th>" + result.barcode + "</th><th><a href='" + result.link + "' target='_blank'>Visualizar</a></th>";
                                var $htmlInfo = "<th>" + result.plan.id + "</th><th>" + result.plan.interval + "</th><th>" + result.expire_at + "</th><th>" + result.total + "</th>";

                                document.getElementById('table-geral').innerHTML = $htmlGeral;
                                document.getElementById('table-info').innerHTML = $htmlInfo;
                            }
                            else {
                                $("#myModal").modal('hide');
                                alert("Code: " + success.code + '\n' + 'Property: ' + success.error_description.property + '\n' + 'Message: ' + success.error_description.message)
                            }
                        },
                        error: function (error) {
                            $("#myModal").modal('hide');
                            var msg = JSON.stringify(error);
                            alert("Ocorreu um erro - Mensagem: \n" + msg);
                        }
                    });
                }
            } else {
                alert('Você deverá preencher todos os dados do formulário.');
            }
        } else {
            alert('Você deverá preencher todos os dados do formulário.');
        }

    });

    //eventos para forma de pagemento
    $('#boleto').click(function (event) {
        $('#cartao').removeClass('active');
        $(this).addClass('active');
        $('#form-cartao').addClass('hide');
        $('#form-boleto').removeClass('hide');
    });

    $('#cartao').click(function (event) {
        $('#boleto').removeClass('active');
        $(this).addClass('active');
        $('#form-boleto').addClass('hide');
        $('#form-cartao').removeClass('hide');
    });

    //end para os eventos da forma de pagamento

    var consulta;

    $gn.ready(function (checkout) {
        consulta = checkout;
    });
    /**Fim do script */


    // fun��o para gerar o token da transa��o
    function gerarToken(callbackSubmit) {
        // fun��o de callback
        var callback = function (error, response) {
            if (error) {
                console.log(error);
            } else {
                console.log(response);
                document.getElementById('token').value = response.data.payment_token;
                callbackSubmit();
            }

        };
        //fun��o para gerar o payment_token
        consulta.getPaymentToken({
            brand: document.getElementById('brand').value, // bandeira do cart�o
            number: document.getElementById('numero').value, // n�mero do cart�o
            cvv: document.getElementById('cvv').value, // c�digo de seguran�a
            expiration_month: document.getElementById('expiration_month').value, // m�s de vencimento
            expiration_year: document.getElementById('expiration_year').value // ano de vencimento
        }, callback); // fun��o de callback 

    }


});